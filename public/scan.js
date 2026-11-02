/* Receipt reading with Gemini through Firebase AI Logic.
   Loaded on demand by app.js (dynamic import), so the AI SDK costs nothing until someone scans. */
import {initializeApp,getApps} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import {initializeAppCheck,ReCaptchaEnterpriseProvider} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app-check.js';
import {getAI,getGenerativeModel,GoogleAIBackend,Schema} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-ai.js';

/* Flash-Lite reads a 70-line receipt photo in ~8-10s with no errors in testing and has a much larger free quota.
   Flash (with its default "thinking") took 30s+ and only allows 20 free requests a day, so it is only a fallback,
   with thinking turned down. */
const MODELS=[
 {name:'gemini-3.5-flash-lite',gen:{}},
 {name:'gemini-3.8-flash',gen:{thinkingConfig:{thinkingLevel:'LOW'}}}
];
const TIMEOUT=45000;

const PROMPT=`You read photos of shop and restaurant receipts (mostly from the Philippines, amounts in pesos) so a group can split the bill.
Extract what was bought and every line that changes the amount payable. Read numbers exactly as printed.

If the images are not a receipt, bill or invoice, set isReceipt to false and return empty lists.
Several images may show different parts of the same long receipt: combine them and never list an overlapping line twice.

place: the store or restaurant name customers know (e.g. "Jollibee", not the registered company name). "" if not visible.
date: the purchase date as YYYY-MM-DD. Philippine receipts usually print dates as MM/DD/YYYY. "" if not visible.
total: the final amount due, in pesos. 0 if not visible.

items: every purchased line.
- name: the item as printed. Expand an abbreviation only when you are sure of it. Do not put the quantity in the name.
- quantity: number of units, 1 if not shown.
- price: the line total after quantity (e.g. "2 @ 45.00  90.00" gives 90).
- An add-on or modifier that has its own price belongs to the item above it: add it to that item's price and append it to the name (e.g. "Burger + Cheese").
- A discount or void printed directly under a single item and only for that item: subtract it from that item's price.
- Skip lines with no price or a zero price (e.g. "no ice", "less sugar").

extras: bill-level lines that change the amount payable, such as service charge, delivery fee, packaging or takeout fee, tip,
senior citizen or PWD discount, VAT exemption for seniors/PWD ("Less VAT", "VAT exempt adjustment"), promo, voucher or coupon discounts,
and sales tax that is added ON TOP of the item prices.
- kind: "charge" if it adds to the bill, "discount" if it reduces it.
- amount: the peso amount printed on that line as a positive number, 0 if only a percentage is printed.
- percent: the percentage printed on that line (e.g. 10 for "Service Charge 10%"), 0 if none.
Never include lines that only summarise the bill or describe tax already inside the prices: subtotal, total, amount due,
"VATable sales", "VAT amount" or "12% VAT" when prices already include VAT, "VAT-exempt sales", "zero-rated sales",
cash tendered, change, card or e-wallet payment, points, item count.

Before answering, check that the sum of item prices + charge amounts - discount amounts equals total.
If it does not, re-read the receipt: a line is probably missing or duplicated, or a VAT line was wrongly treated as a charge.`;

const SCHEMA=Schema.object({properties:{
 isReceipt:Schema.boolean(),
 place:Schema.string(),
 date:Schema.string(),
 total:Schema.number(),
 items:Schema.array({items:Schema.object({properties:{name:Schema.string(),quantity:Schema.number(),price:Schema.number()}})}),
 extras:Schema.array({items:Schema.object({properties:{
  label:Schema.string(),kind:Schema.enumString({enum:['charge','discount']}),amount:Schema.number(),percent:Schema.number()}})})
}});

let ai=null;
const models={},spent=new Set();
function getModel(m,config,recaptchaKey){
 if(models[m.name])return models[m.name];
 if(!ai)ai=initAI(config,recaptchaKey);
 return models[m.name]=getGenerativeModel(ai,{model:m.name,generationConfig:{responseMimeType:'application/json',responseSchema:SCHEMA,...m.gen}});
}
function initAI(config,recaptchaKey){
 // a separate (modular) app instance: the rest of the site uses the compat SDK, which has no AI module
 const app=getApps().find(a=>a.name==='scan')||initializeApp(config,'scan');
 if(recaptchaKey){
  // local testing: the SDK logs a debug token to the console; register it under App Check > Manage debug tokens
  if(['localhost','127.0.0.1'].includes(location.hostname))self.FIREBASE_APPCHECK_DEBUG_TOKEN=true;
  initializeAppCheck(app,{provider:new ReCaptchaEnterpriseProvider(recaptchaKey),isTokenAutoRefreshEnabled:true});
 }
 return getAI(app,{backend:new GoogleAIBackend(),useLimitedUseAppCheckTokens:!!recaptchaKey});
}

// Gemini returns 500/503 ("high demand") or 429 when a model is overloaded; those are worth retrying.
const msg=e=>String(e?.message||e);
const busy=e=>/\b(500|502|503|504|429)\b|high demand|overloaded|unavailable|resource.?exhausted|try again later|timeout|abort/i.test(msg(e));
// a used-up daily quota won't recover for hours, so stop calling that model for the rest of the visit
const dailyOut=e=>/per day|requests per day|PerDay/i.test(msg(e));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* Called when the user taps Scan: loads the SDK and starts App Check/reCAPTCHA while they pick a photo. */
export function warm({config,recaptchaKey}){getModel(MODELS[0],config,recaptchaKey)}

const b64=blob=>new Promise((ok,no)=>{const r=new FileReader();
 r.onload=()=>ok(String(r.result).split(',')[1]);r.onerror=()=>no(r.error||new Error('Could not read image'));r.readAsDataURL(blob)});

/* images: JPEG/PNG blobs of one receipt. Returns the raw parsed JSON; app.js validates every field. */
export async function readReceipt(images,{config,recaptchaKey}){
 const parts=await Promise.all(images.map(async b=>({inlineData:{data:await b64(b),mimeType:b.type||'image/jpeg'}})));
 // main model, one quick retry if it's momentarily overloaded, then the fallback model
 const plan=[[MODELS[0],0],[MODELS[0],1000],[MODELS[1],0]];
 let err;
 for(const [m,wait] of plan){
  if(spent.has(m.name))continue;
  if(wait)await sleep(wait);
  try{const r=await getModel(m,config,recaptchaKey).generateContent([PROMPT,...parts],{timeout:TIMEOUT});return JSON.parse(r.response.text())}
  catch(e){err=e;if(!busy(e))throw e;if(dailyOut(e))spent.add(m.name);console.warn(`Receipt reader ${m.name} unavailable, trying next`,e)}
 }
 throw err||new Error('Receipt reader quota reached for today (per day)');
}
