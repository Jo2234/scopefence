import type {Analysis,AnalysisItem} from '../../src/domain/index.js';
import type {EvalCase} from '../../eval/types.js';
export function item(c:EvalCase,anchor:string,overrides:Partial<AnalysisItem>={}):AnalysisItem {
  const start=c.message.indexOf(anchor);
  return {id:'I1',request:anchor,message_quote:anchor,message_span:start<0?null:{start,end:start+anchor.length},
    model_label:'extra_work',label:'extra_work',reason:'Test prediction',question:'',reason_codes:[],model_clause_id:null,clause_id:null,
    brief_quote:'',brief_span:null,citation_status:'absent',included_basis:'none',deliverable_id:'custom',effort:'s',
    pricing:{mode:'hourly',hours_hundredths:150,quantity:1},review:'proposed',edited:false,duplicate_of:null,injection_overlap:false,...overrides};
}
export function analysis(c:EvalCase,items:AnalysisItem[],overrides:Partial<Analysis>={}):Analysis {
  return {id:'test',reference:'SF-12345678',mode:'fixture',model:{id:'scripted',file:null,runtime:'hand-written test fixture',provenance:'hand-written test fixture'},
    prompt_version:'pv1',created_at:'2026-10-16T00:00:00.000Z',latency_ms:1000,attempts:1,timings:{prompt_tokens:100,predicted_tokens:20,prompt_ms:200,predicted_ms:800},
    input:{brief:c.brief,message:c.message,rate_card:c.rate_card},truncated:{brief:false,message:false,brief_dropped_chars:0,message_dropped_chars:0},
    clauses:[],injection:{suspected:false,spans:[]},items,warnings:[],raw_model_output:'{"items":[]}',...overrides};
}
