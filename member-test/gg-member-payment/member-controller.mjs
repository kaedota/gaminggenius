import {contextKey, normalizePhone, safeReview, isUuid} from './flow-model.mjs?v=paid-only-v1';

const ACTIONS = new Set(['start_member_tac','verify_member_tac','pay_member_tac','read_member_tac_result','recover_member_tac','close_unpaid_member_tac']);
const INTENT_STATES = new Set(['prepared', 'processing', 'settled', 'failed', 'uncertain']);
const copy = value => structuredClone(value);
const fail = code => {throw Error(code);};
const cleanContext = value => JSON.parse(contextKey(value));
const validBooking = context => context.purpose === 'lookup' || ['PS5', 'Switch', 'SIM01', 'SIM02'].includes(context.booking.station);

export function hasFinancialRecovery(store, userId) {
  try {
    const raw=store?.getItem('gg-member-payment-v1:'+userId);if(raw==null)return false;const saved=JSON.parse(raw);
    return saved?.flow!=='payment_only'||saved.userId!==userId||!isUuid(saved.requestId)||saved.attempted===true;
  } catch {return true;}
}
export function memberStorageKey(userId,purpose='booking_balance'){return(purpose==='lookup'?'gg-member-lookup-v1:':'gg-member-payment-v1:')+userId;}
export function hasMemberRecovery(store,userId,purpose){try{return store?.getItem(memberStorageKey(userId,purpose))!=null;}catch{return true;}}
export function storedMemberContext(store,userId,purpose){try{const row=JSON.parse(store?.getItem(memberStorageKey(userId,purpose))||'null'),context=cleanContext(row?.context);return row?.flow==='payment_only'&&row.userId===userId&&isUuid(row.requestId)&&validBooking(context)?context:null;}catch{return null;}}

export function createMemberController({call, context, userId, enabled = false, readOnly=false,
  store = null, now = () => Date.now(), uuid = () => crypto.randomUUID(), onChange = () => {}, onSettled = () => {}}) {
  context = cleanContext(context);
  if (!validBooking(context)) fail('INVALID_CONTEXT');
  const allowed = enabled === true && isUuid(userId);
  const lookupMode=context.purpose==='lookup',storageKey=memberStorageKey(userId,context.purpose);
  let disposed = false, generation = 0, notified = false;
  let state = {phase:allowed?(readOnly?'read_only':'phone'):'disabled',readOnly:readOnly===true,context,phone:'',challengeId:null,requestId:null,
    expiresAt:0,retryAt:0,proof:null,review:null,intent:null,attempted:false,sendAttempted:false,busy:false,error:null,startError:null,canClose:false};

  // This is a recovery reference, not an authorisation token. Never persist proof,
  // TAC, phone, member name/balance/points or an API credential.
  function persist() {
    if (!store) fail('RECOVERY_STORAGE_UNAVAILABLE');
    store.setItem(storageKey, JSON.stringify({v:1,flow:'payment_only',userId,context:state.context,
      challengeId: state.challengeId, requestId: state.requestId, attempted: state.attempted,sendAttempted:state.sendAttempted,startError:state.startError,
      expiresAt: state.expiresAt, retryAt: state.retryAt}));
  }
  function removeRecovery() {try {store?.removeItem(storageKey);} catch {}}
  if (allowed) {
    try {
      const raw=store?.getItem(storageKey),saved = JSON.parse(raw || 'null');
      if (saved?.v===1&&saved.flow==='payment_only'&&saved.userId===userId&&isUuid(saved.requestId)) {
        const restored = cleanContext(saved.context);
        if(!validBooking(restored)||(restored.purpose==='lookup')!==lookupMode)fail('RECOVERY_STORAGE_REVIEW');
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
  function ensure() {if (!allowed || disposed || ['auth', 'disabled'].includes(state.phase)) fail('MEMBER_TAC_NOT_OPEN');}
  function ensureMutation(){ensure();if(readOnly)fail('MEMBER_TAC_NOT_OPEN');}
  async function api(action, payload) {
    if (!ACTIONS.has(action)) fail('INVALID_ACTION');
    const result = await call(action, payload);
    if(!result||result.flow!=='payment_only'||result.live_candidate===true||result.dry_run===true)fail('TAC_RESPONSE_INVALID');
    return result;
  }
  function intentResult(result) {
    const intent = result.intent;
    if (!intent || !isUuid(intent.id) || intent.booking_id!==null&&!isUuid(intent.booking_id) || !INTENT_STATES.has(intent.state) ||
      intent.kind !== state.context.purpose || !Number.isSafeInteger(intent.cents) || intent.cents <= 0 ||
      !Number.isSafeInteger(intent.points) || intent.points < 0) fail('TAC_RESPONSE_INVALID');
    if (state.review && (intent.cents !== state.review.quote.cents || intent.points !== state.review.quote.points)) fail('TAC_DETAILS_CHANGED');
    const settled=intent.state==='settled',chargedReview=settled&&result.charged===true&&result.booking_confirmed===false&&result.requires_staff_review===true&&(intent.allocation_state==='paid_unallocated'||intent.refund_state==='review');if(result.booking_confirmed===true&&(!isUuid(intent.booking_id)||intent.booking_payment_status!=='paid'||!['confirmed','checked_in','completed'].includes(intent.booking_status)))fail('TAC_RESPONSE_INVALID');
    if (!chargedReview&&(result.charged !== settled || result.booking_confirmed !== settled)) fail('TAC_RESPONSE_INVALID');
    const safeIntent=Object.fromEntries(['id','order_id','booking_id','kind','cents','points','state','booking_status','booking_payment_status','allocation_state','refund_state','requires_staff_review'].filter(k=>intent[k]!==undefined).map(k=>[k,intent[k]]));
    change({intent:safeIntent,proof:null,busy:false,attempted:true,charged:result.charged,bookingConfirmed:result.booking_confirmed,
      phase:chargedReview?'charged_review':settled?'settled':intent.state==='failed'?'failed':'uncertain',error:chargedReview?'BOOKING_REVIEW_REQUIRED':null});
    persist();
    if (settled&&!chargedReview) removeRecovery();
    if (settled&&!chargedReview&&!notified) {notified = true; try {onSettled(copy(safeIntent));} catch {}}
  }
  function authOrError(error, fallbackPhase) {
    if(['AUTH_REQUIRED','AUTH_ACCOUNT_CHANGED'].includes(error?.message)){signOut();return;}
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
      const response = await api('start_member_tac', payload);
      if (disposed || token !== generation) return;
      if(!isUuid(response.challenge_id)||response.request_id!==requestId||!Number.isInteger(response.expires_in)||response.expires_in<0||response.expires_in>300||!Number.isInteger(response.retry_after)||response.retry_after<0||response.retry_after>60||typeof response.can_verify!=='boolean')fail('TAC_RESPONSE_INVALID');
      change({phase:response.can_verify&&response.expires_in>0?'code':response.expires_in===0?'expired':'send_unknown',challengeId:response.challenge_id,expiresAt:now()+response.expires_in*1000,
        retryAt:now()+response.retry_after*1000,busy:false,canClose:response.can_close_unpaid===true,providerAccepted:typeof response.provider_accepted==='boolean'?response.provider_accepted:null});
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
      const response = await api('verify_member_tac', {challenge_id: state.challengeId, code});
      if (disposed || token !== generation) return;
      if(response.verified!==true||response.purpose!==state.context.purpose||now()>=state.expiresAt)fail('TAC_RESPONSE_INVALID');
      if (state.context.purpose === 'lookup') {
        if(response.lookup_only!==true||response.proof!==undefined||response.intent!==undefined||!Number.isInteger(response.expires_in)||response.expires_in<=0||response.expires_in>300)fail('TAC_RESPONSE_INVALID');
        change({phase:'lookup',busy:false,proof:null,review:safeReview(response.review,state.context),expiresAt:Math.min(state.expiresAt,now()+response.expires_in*1000)});return;
      }
      if(response.lookup_only!==false||typeof response.proof!=='string'||response.proof.length<32||response.proof.length>512||
          !Number.isInteger(response.expires_in) || response.expires_in < 1 || response.expires_in > 300) fail('TAC_RESPONSE_INVALID');
      const review = safeReview(response.review, state.context);
      change({phase: 'review', busy: false, review, proof: response.proof,
        expiresAt: Math.min(state.expiresAt, now() + response.expires_in * 1000)});
    } catch(error){if(!disposed&&token===generation){if(error?.message==='TAC_SERVICE_UNAVAILABLE'){change({busy:false,proof:null,phase:'resume',error:'TAC_VERIFY_RESULT_UNKNOWN'});await recover();}
      else if(['MEMBER_NOT_FOUND','MEMBER_REVIEW_REQUIRED','MEMBER_CREDIT_REVIEW','TAC_EXPIRED'].includes(error?.message)){const code=error.message;change({busy:false,proof:null,error:code});await recover();if(!disposed&&token===generation)change({error:code});}
      else authOrError(error,'code');}}
  }
  async function pay() {
    if(lookupMode||state.context.purpose==='lookup')return;
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
      const result = await api('pay_member_tac', payload);
      if (!disposed && token === generation) intentResult(result);
    } catch (error) {if (!disposed && token === generation) authOrError(error, 'uncertain');}
    finally {payload.proof = null; state = {...state, proof: null};}
  }
  async function read() {
    ensure(); if(state.busy||!state.requestId)return;
    if(lookupMode&&state.challengeId&&['lookup','lookup_ready'].includes(state.phase)){const token=generation;change({busy:true,error:null});try{const result=await api('read_member_tac_result',{challenge_id:state.challengeId,request_id:state.requestId});if(disposed||token!==generation)return;
      if(result.purpose!=='lookup'||result.lookup_only!==true||result.proof!==undefined||result.intent!==undefined||result.charged!==false||result.booking_confirmed!==false)fail('TAC_RESPONSE_INVALID');
      if(result.state==='expired'){change({phase:'expired',busy:false,review:null,proof:null,expiresAt:0,error:'TAC_EXPIRED'});return;}
      if(result.state!=='verified_lookup'||!Number.isInteger(result.expires_in)||result.expires_in<=0||result.expires_in>300)fail('TAC_RESPONSE_INVALID');
      change({phase:'lookup',busy:false,review:safeReview(result.review,state.context),proof:null,expiresAt:Math.min(state.expiresAt||Infinity,now()+result.expires_in*1000)});
      }catch(error){if(!disposed&&token===generation)authOrError(error,'resume');}return;}
    if(!state.challengeId||!state.attempted){await recover();return;}
    const token = generation;
    change({busy: true, error: null});
    try {
      const result = await api('read_member_tac_result', {challenge_id: state.challengeId, request_id: state.requestId});
      if (disposed || token !== generation) return;
      if (result.intent) intentResult(result);
      else {
        if (!['pending','verified','verified_payment','expired','failed','locked','submitted','uncertain','reserved','superseded','closed_unpaid'].includes(result.state) || result.charged !== false || result.booking_confirmed !== false) fail('TAC_RESPONSE_INVALID');
        change({busy: false, phase: state.attempted ? 'uncertain' : 'verified_no_proof', proof: null, review: null,canClose:true,
          error: state.attempted ? 'PAYMENT_REVIEW_REQUIRED' : 'TAC_VERIFY_AGAIN'});
      }
    } catch (error) {if (!disposed && token === generation) authOrError(error, state.attempted ? 'uncertain' : 'resume');}
  }
  async function recover(){
    ensure();if(state.busy||!state.requestId)return;const token=generation;change({busy:true,error:null});
    try{const meta=await api('recover_member_tac',{request_id:state.requestId});if(disposed||token!==generation)return;
      if(meta.request_id!==state.requestId||typeof meta.found!=='boolean'||meta.can_send!==false)fail('TAC_RESPONSE_INVALID');
      if(!meta.found){if(meta.intent||meta.charged!==false||meta.booking_confirmed!==false)fail('TAC_RESPONSE_INVALID');change({busy:false,proof:null,review:null,canClose:true,phase:state.attempted?'uncertain':'no_record',error:state.attempted?'PAYMENT_REVIEW_REQUIRED':null});return;}
      if(!isUuid(meta.challenge_id)||contextKey({purpose:meta.purpose,booking:meta.booking})!==contextKey(state.context)||!Number.isInteger(meta.expires_in)||meta.expires_in<0||meta.expires_in>300||meta.can_confirm!==false||typeof meta.can_verify!=='boolean')fail('TAC_RESPONSE_INVALID');
      if(meta.intent){if(lookupMode)fail('TAC_RESPONSE_INVALID');intentResult(meta);return;}
      if(meta.charged!==false||meta.booking_confirmed!==false)fail('TAC_RESPONSE_INVALID');
      state={...state,challengeId:meta.challenge_id,expiresAt:now()+meta.expires_in*1000};persist();
      let phase=state.attempted?'uncertain':lookupMode&&(meta.delivery_state==='verified_lookup'||meta.state==='verified_lookup')?'lookup_ready':readOnly?'read_only':meta.can_verify===true&&meta.expires_in>0?'code':meta.delivery_state==='verified_payment'||meta.state==='verified_payment'?'verified_no_proof':meta.expires_in===0?'expired':'send_unknown';
      change({busy:false,proof:null,review:null,phase,canClose:meta.can_close_unpaid===true||!meta.intent&&meta.charged===false,error:state.attempted?'PAYMENT_REVIEW_REQUIRED':null});
      if(phase==='lookup_ready')await read();
    }catch(error){if(!disposed&&token===generation)authOrError(error,state.attempted?'uncertain':'recovery_unavailable');}
  }
  async function closeUnpaid(){
    ensure();if(state.busy||!state.requestId||state.intent&&state.intent.state!=='failed')return;const token=generation,requestId=state.requestId;change({busy:true,proof:null,review:null,error:null});
    try{const result=await api('close_unpaid_member_tac',{request_id:requestId});if(disposed||token!==generation)return;
      if(result.request_id!==requestId)fail('TAC_RESPONSE_INVALID');
      if(result.closed!==true||result.can_prepare_new!==true){const financial=result.reason==='MEMBER_PAYMENT_REVIEW';state={...state,attempted:state.attempted||financial,canClose:false};persist();change({busy:false,phase:financial?'uncertain':'resume',error:financial?'PAYMENT_REVIEW_REQUIRED':'TAC_UNPAID_CLOSE_UNSAFE'});return;}
      if(result.charged!==false||result.booking_confirmed!==false)fail('TAC_RESPONSE_INVALID');
      const historyKey=(lookupMode?'gg-member-lookup-history-v1:':'gg-member-payment-history-v1:')+userId,rows=JSON.parse(store.getItem(historyKey)||'[]');if(!Array.isArray(rows))fail('RECOVERY_STORAGE_REVIEW');
      store.setItem(historyKey,JSON.stringify([...rows,{flow:'payment_only',userId,requestId,challengeId:state.challengeId,purpose:state.context.purpose,status:'closed_unpaid',closedAt:now()}]));removeRecovery();++generation;
      change({phase:readOnly?'disabled':'phone',phone:'',attempted:false,charged:false,bookingConfirmed:false,requestId:null,challengeId:null,proof:null,review:null,intent:null,sendAttempted:false,canClose:false,busy:false,error:null,startError:null,expiresAt:0,retryAt:0});
    }catch(error){if(!disposed&&token===generation)authOrError(error,'resume');}
  }
  function restart() {
    ensure(); if (state.busy || state.attempted) return;
    if(readOnly)return;
    if(lookupMode){++generation;removeRecovery();change({phase:'phone',phone:'',proof:null,review:null,requestId:null,challengeId:null,sendAttempted:false,error:null,expiresAt:0,retryAt:0});return;}
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
  function expireLookup(){if(lookupMode&&state.phase==='lookup'&&now()>=state.expiresAt)change({phase:'expired',review:null,proof:null,error:'TAC_EXPIRED'});}
  emit();
  return {get view(){return view();},start,verify,pay,read,recover,restart,closeUnpaid,setContext,signOut,dispose,expireLookup};
}
