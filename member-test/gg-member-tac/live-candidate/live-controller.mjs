import {contextKey, normalizePhone, safeReview, isUuid} from './shared-model.mjs?v=owner-live-v2';

const ACTIONS = new Set(['start_live_tac', 'verify_live_tac', 'pay_live_tac', 'read_live_tac_result', 'recover_live_tac_request']);
const INTENT_STATES = new Set(['prepared', 'processing', 'settled', 'failed', 'uncertain']);
const copy = value => structuredClone(value);
const fail = code => {throw Error(code);};
const cleanContext = value => JSON.parse(contextKey(value));
const validBooking = context => context.purpose === 'link' || ['PS5', 'Switch', 'SIM01', 'SIM02'].includes(context.booking.station);

export function hasSubmittedRecovery(store, userId) {
  try {
    const saved = JSON.parse(store?.getItem('gg-tac-live-intent-v1:' + userId) || 'null');
    return saved?.v === 1 && saved.userId === userId && saved.attempted === true && isUuid(saved.challengeId) && isUuid(saved.requestId);
  } catch {return false;}
}
export function hasAnyRecovery(store,userId){try{return store?.getItem('gg-tac-live-intent-v1:'+userId)!=null;}catch{return true;}}
export function storedRecoveryContext(store,userId){try{const row=JSON.parse(store?.getItem('gg-tac-live-intent-v1:'+userId)||'null'),context=cleanContext(row?.context);return row?.userId===userId&&isUuid(row.requestId)&&validBooking(context)?context:null;}catch{return null;}}

export function createLiveController({call, context, userId, enabled = false, ownerAcceptance = false,readOnly=false,
  store = null, now = () => Date.now(), uuid = () => crypto.randomUUID(), onChange = () => {}, onSettled = () => {}}) {
  context = cleanContext(context);
  if (!validBooking(context)) fail('INVALID_CONTEXT');
  const allowed = enabled === true && ownerAcceptance === true && isUuid(userId);
  const storageKey = 'gg-tac-live-intent-v1:' + userId;
  let disposed = false, generation = 0, notified = false;
  let state = {phase:allowed?(readOnly?'read_only':'phone'):'disabled',readOnly:readOnly===true,context,phone:'',challengeId:null,requestId:null,
    expiresAt: 0, retryAt: 0, proof: null, review: null, intent: null, attempted: false, sendAttempted:false, busy: false, error: null, startError:null};

  // This is a recovery reference, not an authorisation token. Never persist proof,
  // TAC, phone, member name/balance/points or an API credential.
  function persist() {
    if (!store) fail('RECOVERY_STORAGE_UNAVAILABLE');
    store.setItem(storageKey, JSON.stringify({v: 1, userId, context: state.context,
      challengeId: state.challengeId, requestId: state.requestId, attempted: state.attempted,sendAttempted:state.sendAttempted,startError:state.startError,
      expiresAt: state.expiresAt, retryAt: state.retryAt}));
  }
  function removeRecovery() {try {store?.removeItem(storageKey);} catch {}}
  if (allowed) {
    try {
      const raw=store?.getItem(storageKey),saved = JSON.parse(raw || 'null');
      if (saved?.v === 1 && saved.userId === userId && isUuid(saved.requestId)) {
        const restored = cleanContext(saved.context);
        if(!validBooking(restored))fail('RECOVERY_STORAGE_REVIEW');
        state = {...state, context: restored, challengeId: isUuid(saved.challengeId)?saved.challengeId:null,
          requestId: saved.requestId, attempted: saved.attempted === true,sendAttempted:true,startError:typeof saved.startError==='string'&&/^[A-Z_]+$/.test(saved.startError)?saved.startError:null,phase: 'resume',
          expiresAt: Number(saved.expiresAt) || 0, retryAt: Number(saved.retryAt) || 0};
      }else if(raw!=null)state={...state,phase:'storage_review',attempted:true,sendAttempted:true,error:'RECOVERY_STORAGE_REVIEW'};
    } catch {state={...state,phase:'storage_review',attempted:true,sendAttempted:true,error:'RECOVERY_STORAGE_REVIEW'};}
  }
  function view() {
    const {proof, ...safe} = state;
    return copy({...safe, secondsLeft: Math.max(0, Math.ceil((state.expiresAt - now()) / 1000)),
      resendLeft: Math.max(0, Math.ceil((state.retryAt - now()) / 1000))});
  }
  function emit() {if (!disposed) onChange(view());}
  function change(update) {state = {...state, ...update}; emit();}
  function ensure() {if (!allowed || disposed || ['auth', 'disabled'].includes(state.phase)) fail('TAC_LIVE_DISABLED');}
  function ensureMutation(){ensure();if(readOnly)fail('TAC_LIVE_NOT_OPEN');}
  async function api(action, payload) {
    if (!ACTIONS.has(action)) fail('INVALID_ACTION');
    const result = await call(action, payload);
    if (!result || result.live_candidate !== true || result.dry_run === true) fail('TAC_RESPONSE_INVALID');
    return result;
  }
  function intentResult(result) {
    const intent = result.intent;
    if (!intent || !isUuid(intent.id) || !isUuid(intent.booking_id) || !INTENT_STATES.has(intent.state) ||
      intent.kind !== state.context.purpose || !Number.isSafeInteger(intent.cents) || intent.cents <= 0 ||
      !Number.isSafeInteger(intent.points) || intent.points < 0) fail('TAC_RESPONSE_INVALID');
    if (state.review && (intent.cents !== state.review.quote.cents || intent.points !== state.review.quote.points)) fail('TAC_DETAILS_CHANGED');
    const settled = intent.state === 'settled',chargedReview=settled&&result.charged===true&&result.booking_confirmed===false&&result.requires_staff_review===true;
    if (!chargedReview&&(result.charged !== settled || result.booking_confirmed !== settled)) fail('TAC_RESPONSE_INVALID');
    const safeIntent=Object.fromEntries(['id','booking_id','kind','cents','points','state','booking_status','booking_payment_status'].filter(k=>intent[k]!==undefined).map(k=>[k,intent[k]]));
    change({intent:safeIntent,proof:null,busy:false,attempted:true,charged:result.charged,bookingConfirmed:result.booking_confirmed,
      phase:chargedReview?'charged_review':settled?'settled':intent.state==='failed'?'failed':'uncertain',error:chargedReview?'BOOKING_REVIEW_REQUIRED':null});
    persist();
    if (settled&&!chargedReview) removeRecovery();
    if (settled&&!chargedReview&&!notified) {notified = true; try {onSettled(copy(safeIntent));} catch {}}
  }
  function authOrError(error, fallbackPhase) {
    if (error?.message === 'AUTH_REQUIRED') {signOut(); return;}
    change({busy: false, phase: fallbackPhase, proof: fallbackPhase === 'uncertain' ? null : state.proof,
      error: error?.message || 'TAC_SERVICE_UNAVAILABLE'});
  }
  async function start(phone, {resend = false} = {}) {
    ensureMutation(); if (state.busy || state.attempted) return;
    if(state.sendAttempted&&state.requestId){await recover();return;}
    let normalized;
    try {normalized = normalizePhone(phone);} catch (error) {authOrError(error, 'phone'); return;}
    const requestId = uuid();
    const token = ++generation;
    change({phase: 'phone', phone: normalized, requestId, challengeId: null, proof: null, review: null,
      busy: true, error: null, intent: null,sendAttempted:true,startError:null});
    const payload = {phone: normalized, purpose: state.context.purpose, request_id: requestId};
    if (state.context.booking) payload.booking = copy(state.context.booking);
    try{persist();}catch(error){change({busy:false,sendAttempted:false,requestId:null,error:'RECOVERY_STORAGE_UNAVAILABLE'});return;}
    try {
      const response = await api('start_live_tac', payload);
      if (disposed || token !== generation) return;
      if (!isUuid(response.challenge_id) || response.request_id !== requestId || !Number.isInteger(response.expires_in) ||
          response.expires_in < 1 || response.expires_in > 300 || response.retry_after !== 60) fail('TAC_RESPONSE_INVALID');
      change({phase: 'code', challengeId: response.challenge_id, expiresAt: now() + response.expires_in * 1000,
        retryAt: now() + response.retry_after * 1000, busy: false});
      persist();
    } catch (error) {if(!disposed&&token===generation){state={...state,busy:false,phase:'send_unknown',startError:/^[A-Z_]+$/.test(error?.message||'')?error.message:'TAC_SERVICE_UNAVAILABLE'};try{persist();}catch{}emit();await recover();}}
  }
  async function verify(code) {
    ensureMutation(); if (state.busy || state.phase !== 'code' || state.attempted) return;
    if (now() >= state.expiresAt) {change({error: 'TAC_EXPIRED'}); return;}
    if (!/^\d{6}$/.test(code)) {change({error: 'TAC_INVALID_CODE'}); return;}
    const token = generation;
    change({busy: true, error: null});
    try {
      const response = await api('verify_live_tac', {challenge_id: state.challengeId, code});
      if (disposed || token !== generation) return;
      if (response.verified !== true || now() >= state.expiresAt) fail('TAC_EXPIRED');
      if (state.context.purpose === 'link') {
        if (response.linked !== true) fail('TAC_RESPONSE_INVALID');
        change({phase: 'linked', busy: false, proof: null}); removeRecovery(); return;
      }
      if (response.linked !== false || typeof response.proof !== 'string' || response.proof.length < 32 || response.proof.length > 512 ||
          !Number.isInteger(response.expires_in) || response.expires_in < 1 || response.expires_in > 300) fail('TAC_RESPONSE_INVALID');
      const review = safeReview(response.review, state.context);
      change({phase: 'review', busy: false, review, proof: response.proof,
        expiresAt: Math.min(state.expiresAt, now() + response.expires_in * 1000)});
    } catch (error) {if (!disposed && token === generation){if(error?.message==='TAC_SERVICE_UNAVAILABLE'){change({busy:false,proof:null,phase:'resume',error:'TAC_VERIFY_RESULT_UNKNOWN'});await recover();}else authOrError(error,'code');}}
  }
  async function pay() {
    ensureMutation(); if (state.busy || state.phase !== 'review' || !state.proof || state.attempted) return;
    if (now() >= state.expiresAt) {change({proof: null, phase: 'code', error: 'TAC_EXPIRED'}); return;}
    const payload = {challenge_id: state.challengeId, request_id: state.requestId, proof: state.proof};
    const token = generation;
    // Persist BEFORE the only debit attempt. A lost response/reload must offer
    // read-only reconciliation, never a new debit or a new request_id.
    state = {...state, attempted: true, busy: true, phase: 'processing', error: null};
    try {persist();} catch (error) {state = {...state, attempted: false, busy: false, phase: 'review', error: error.message}; emit(); return;}
    emit();
    try {
      const result = await api('pay_live_tac', payload);
      if (!disposed && token === generation) intentResult(result);
    } catch (error) {if (!disposed && token === generation) authOrError(error, 'uncertain');}
    finally {payload.proof = null; state = {...state, proof: null};}
  }
  async function read() {
    ensure(); if(state.busy||!state.requestId)return;
    if(!state.challengeId||!state.attempted){await recover();return;}
    const token = generation;
    change({busy: true, error: null});
    try {
      const result = await api('read_live_tac_result', {challenge_id: state.challengeId, request_id: state.requestId});
      if (disposed || token !== generation) return;
      if (result.intent) intentResult(result);
      else {
        if (!['pending', 'verified'].includes(result.state) || result.charged !== false || result.booking_confirmed !== false) fail('TAC_RESPONSE_INVALID');
        change({busy: false, phase: state.attempted ? 'uncertain' : 'verified_no_proof', proof: null, review: null,
          error: state.attempted ? 'PAYMENT_REVIEW_REQUIRED' : 'TAC_VERIFY_AGAIN'});
      }
    } catch (error) {if (!disposed && token === generation) authOrError(error, state.attempted ? 'uncertain' : 'resume');}
  }
  async function recover(){
    ensure();if(state.busy||!state.requestId)return;const token=generation;change({busy:true,error:null});
    try{const meta=await api('recover_live_tac_request',{request_id:state.requestId});if(disposed||token!==generation)return;
      if(meta.request_id!==state.requestId||typeof meta.found!=='boolean'||meta.can_send!==false)fail('TAC_RESPONSE_INVALID');
      if(!meta.found){if(meta.intent||meta.charged!==false||meta.booking_confirmed!==false)fail('TAC_RESPONSE_INVALID');change({busy:false,proof:null,review:null,phase:state.attempted?'uncertain':'no_record',error:state.attempted?'PAYMENT_REVIEW_REQUIRED':null});return;}
      if(!isUuid(meta.challenge_id)||contextKey({purpose:meta.purpose,booking:meta.booking})!==contextKey(state.context)||!Number.isInteger(meta.expires_in)||meta.expires_in<0||meta.expires_in>300||meta.can_confirm!==false||typeof meta.can_verify!=='boolean')fail('TAC_RESPONSE_INVALID');
      if(meta.intent){intentResult(meta);return;}
      if(meta.charged!==false||meta.booking_confirmed!==false)fail('TAC_RESPONSE_INVALID');
      state={...state,challengeId:meta.challenge_id,expiresAt:now()+meta.expires_in*1000};persist();
      let phase=state.attempted?'uncertain':readOnly?'read_only':meta.can_verify===true&&meta.expires_in>0?'code':meta.delivery_state==='verified_live'||meta.state==='verified_live'?'verified_no_proof':meta.expires_in===0?'expired':'send_unknown';
      change({busy:false,proof:null,review:null,phase,error:state.attempted?'PAYMENT_REVIEW_REQUIRED':null});
    }catch(error){if(!disposed&&token===generation)authOrError(error,state.attempted?'uncertain':'recovery_unavailable');}
  }
  function restart() {
    ensure(); if (state.busy || state.attempted) return;
    if(readOnly)return;
    if(state.sendAttempted){change({proof:null,review:null,phase:'resume',error:'TAC_RECOVERY_REQUIRED'});return;}
    ++generation; removeRecovery();
    change({phase: 'phone', phone: '', proof: null, review: null, requestId: null, challengeId: null, error: null, expiresAt: 0, retryAt: 0});
  }
  function setContext(next) {
    next = cleanContext(next); if (!validBooking(next)) fail('INVALID_CONTEXT');
    if (contextKey(next) === contextKey(state.context)) return;
    if(state.sendAttempted){++generation;change({proof:null,review:null,busy:false,phase:'resume',error:state.attempted?'PAYMENT_REVIEW_REQUIRED':'TAC_CONTEXT_CHANGED'});return;}
    ++generation; removeRecovery();
    change({context: next, phase: allowed ? 'phone' : 'disabled', phone: '', proof: null, review: null,
      requestId: null, challengeId: null, expiresAt: 0, retryAt: 0, busy: false, error: null});
  }
  function signOut() {
    ++generation;
    // Keep only an unresolved submitted reference, scoped to the same user.
    // Signing out must not let a lost debit response become a fresh debit.
    if (!state.sendAttempted&&!state.attempted) removeRecovery();
    change({phase: 'auth', phone: '', proof: null, review: null, intent: null, requestId: null, challengeId: null,
      attempted: false,sendAttempted:false,busy: false,error:null,expiresAt:0,retryAt:0,charged:false,bookingConfirmed:false});
  }
  function dispose() {++generation; state = {...state, proof: null, review: null, phone: '', intent: null}; disposed = true;}
  emit();
  return {get view() {return view();}, start, verify, pay, read,recover,restart,setContext,signOut,dispose};
}
