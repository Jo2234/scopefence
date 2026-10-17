import {makeModelOutputSchema} from '../domain/index.js';
type Clause = {id:string};
type Card = {deliverables:ReadonlyArray<{id:string}>};
export function buildOutputSchema(clauses:ReadonlyArray<Clause>,rate_card:Card){return {
 type:'object',additionalProperties:false,required:['items'],properties:{items:{type:'array',maxItems:8,items:{type:'object',additionalProperties:false,
 required:['message_quote','request','clause_id','brief_quote','label','included_basis','reason','question','deliverable_id','effort'],properties:{
 message_quote:{type:'string',minLength:1,maxLength:300},request:{type:'string',minLength:1,maxLength:140},clause_id:{type:'string',enum:['none',...clauses.map(c=>c.id)]},brief_quote:{type:'string',maxLength:300},label:{type:'string',enum:['included','needs_clarification','extra_work']},included_basis:{type:'string',enum:['deliverable','revision','none']},reason:{type:'string',minLength:1,maxLength:200},question:{type:'string',maxLength:200},deliverable_id:{type:'string',enum:['none','custom',...rate_card.deliverables.map(d=>d.id)]},effort:{type:'string',enum:['xs','s','m','l','none']}
 }}}}};}
// Keep the public helper for G0 scripts while using the shared domain validator.
export function buildModelOutputValidator(clauses:ReadonlyArray<Clause>,rate_card:Card){return makeModelOutputSchema(clauses.map(c=>c.id),rate_card.deliverables.map(d=>d.id));}
