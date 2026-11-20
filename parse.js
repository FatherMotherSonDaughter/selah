/* Simple typed input (free, no AI) — docs/02-architecture.md.
   Understands "in 2 days", "tomorrow 3pm", "next Friday", "every Monday", "[task] by [time]",
   "[name]'s birthday is [date]", "Oct 21", "10/21", "urgent". Whatever it can't place goes to the given day. */
const DAYS=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const DAY_RE='(sun|mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri|sat(?:ur)?)(?:day)?';
const MONTHS=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const MON_RE='(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

const ymd=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const fromYmd=s=>{const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const dayIdx=w=>DAYS.findIndex(d=>d.startsWith(w.slice(0,3)));

/* category + icon from keywords; first match wins */
const CAT_RULES=[
 ['V','plane',/\b(flight|fly|trip|travel|airport|hotel|pack(ing)?|passport|tokyo|seoul|korea|japan|vacation)\b/],
 ['G','building-church',/\b(church|service|worship|sermon)\b/],
 ['G','book',/\b(bible|devotion(al)?|verse|psalm|small group|bible study)\b/],
 ['G','heart',/\b(pray(er|ing)?|fast(ing)?|quiet time)\b/],
 ['R','cake',/\b(birthday|anniversary)\b/],
 ['R','gift',/\b(gift|present)\b/],
 ['R','phone',/\b(call|text|facetime|message)\b.*\b(mom|dad|brother|sister|grandma|grandpa|friend|family|uncle|aunt|cousin)\b|\b(mom|dad|brother|sister|grandma|grandpa|family)\b/],
 ['R','users',/\b(dinner with|lunch with|coffee with|hang ?out|visit|friends?)\b/],
 ['B','world-www',/\b(website|site|landing page|shopify)\b/],
 ['B','briefcase',/\b(polieco|tourian|ad machine|meeting|client|invoice|supplier|work|launch|campaign|ads?|deadline|email|budget|pitch)\b/],
 ['O','alarm',/\b(wake ?up|alarm)\b/],
 ['O','coffee',/\b(breakfast|lunch|dinner|coffee|eat|meal)\b/],
 ['O','barbell',/\b(gym|workout|lift|exercise|training)\b/],
 ['O','run',/\b(run|jog|walk|hike|stretch)\b/],
 ['O','stethoscope',/\b(doctor|dentist|clinic|checkup|appointment|therapy)\b/],
 ['O','pill',/\b(meds?|medicine|pills?|vitamins?)\b/],
 ['O','bed',/\b(sleep|bed|nap|rest)\b/],
 ['Y','shopping-cart',/\b(buy|get|groceries|grocery|milk|eggs|store|shop|order|pick up|costco|target)\b/],
 ['Y','car',/\b(car|gas|oil change|drive|parking)\b/],
 ['Y','home',/\b(clean|laundry|dishes|trash|rent|fix|repair)\b/],
 ['Y','mail',/\b(mail|post office|package|return|ship)\b/]
];
function guessCat(t){t=t.toLowerCase();for(const[c,i,re]of CAT_RULES)if(re.test(t))return{cat:c,icon:i};return{cat:'Y',icon:'check'}}

function to24(h,m,ap,bare){h=+h;m=+(m||0);
 if(ap){ap=ap[0];if(ap=='p'&&h<12)h+=12;if(ap=='a'&&h==12)h=0}
 else if(bare&&h>=1&&h<=7)h+=12; /* "at 7" means 7 PM; "at 9" means 9 AM */
 if(h>23||m>59)return null;return`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`}

function parseInput(raw,base){
 const today=new Date();today.setHours(0,0,0,0);
 base=base||today;
 let s=' '+raw.trim()+' ',low=s.toLowerCase();
 const r={date:null,time:null,by:false,repeat:null,urgent:false};
 /* cut a matched piece out of the text so the title stays clean */
 const take=(re,fn)=>{const m=low.match(re);if(!m)return false;if(fn(m)===false)return false;
  const i=m.index;s=s.slice(0,i)+' '+s.slice(i+m[0].length);low=low.slice(0,i)+' '+low.slice(i+m[0].length);return true};

 take(/\s(urgent|asap)\b|!+(?=\s*$)/,()=>{r.urgent=true});

 /* birthdays: "Sam's birthday is Oct 21" / "birthday Sam 3/14" */
 let birthday=/\bbirthday\b/.test(low);

 /* repeats */
 take(/\s(every ?day|daily)\b/,()=>{r.repeat='daily'});
 take(new RegExp('\\s(every|each)\\s+'+DAY_RE+'\\b'),m=>{r.repeat='weekly';const w=dayIdx(m[2]);r.date=ymd(addDays(today,(w-today.getDay()+7)%7))});
 take(/\s(every week|weekly)\b/,()=>{r.repeat='weekly'});
 take(/\s(every month|monthly)\b/,()=>{r.repeat='monthly'});
 take(/\s(every year|yearly|annually)\b/,()=>{r.repeat='yearly'});

 /* time: "by 2pm", "at 3:30pm", "3pm", "15:00", "at 7", "noon" */
 const setT=(t,by)=>{if(!t)return false;r.time=t;if(by)r.by=true};
 take(/\s(by|at|@)?\s*(noon|midday)\b/,m=>setT('12:00',m[1]=='by'))||
 take(/\s(by|at|@)?\s*midnight\b/,m=>setT('23:59',m[1]=='by'))||
 take(/\s(by|at|@)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.|a|p)\b/,m=>setT(to24(m[2],m[3],m[4]),m[1]=='by'))||
 take(/\s(by|at|@)?\s*([01]?\d|2[0-3]):(\d{2})\b/,m=>setT(to24(m[2],m[3]),m[1]=='by'))||
 take(/\s(by|at|@)\s+(\d{1,2})\b(?!\s*(?:\/|st|nd|rd|th|days?|weeks?))/,m=>setT(to24(m[2],0,null,true),m[1]=='by'));
 take(/\s(this )?morning\b/,()=>{if(!r.time)r.time='09:00'});
 take(/\s(this )?afternoon\b/,()=>{if(!r.time)r.time='14:00'});
 take(/\s(tonight|this evening)\b/,()=>{if(!r.date)r.date=ymd(today);if(!r.time)r.time='19:00'});

 /* dates */
 if(!r.date){
  take(/\s(on\s+)?today\b/,()=>{r.date=ymd(today)})||
  take(/\s(on\s+)?(tomorrow|tmrw?|tmr)\b/,()=>{r.date=ymd(addDays(today,1))})||
  take(/\sin\s+(\d+|a|an|one|two|three|four|five|six|seven)\s+(days?|weeks?|months?)\b/,m=>{
   const n={a:1,an:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7}[m[1]]||+m[1];
   if(m[2][0]=='d')r.date=ymd(addDays(today,n));else if(m[2][0]=='w')r.date=ymd(addDays(today,7*n));
   else{const d=new Date(today);d.setMonth(d.getMonth()+n);r.date=ymd(d)}})||
  take(/\snext week\b/,()=>{r.date=ymd(addDays(today,7))})||
  take(new RegExp('\\s(on\\s+|this\\s+|next\\s+)?'+DAY_RE+'\\b'),m=>{const w=dayIdx(m[2]);let n=(w-today.getDay()+7)%7;
   if((m[1]||'').trim()=='next'&&n==0)n=7;r.date=ymd(addDays(today,n))})||
  take(new RegExp('\\s(?:is\\s+|on\\s+)?'+MON_RE+'\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b'),m=>dateFrom(+MONTHS.indexOf(m[1].slice(0,3)),+m[2],m[3]))||
  take(new RegExp('\\s(?:is\\s+|on\\s+)?(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?'+MON_RE+'\\b(?:,?\\s+(\\d{4}))?'),m=>dateFrom(MONTHS.indexOf(m[2].slice(0,3)),+m[1],m[3]))||
  take(/\s(?:is\s+|on\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/,m=>dateFrom(+m[1]-1,+m[2],m[3]))||
  take(/\s(?:on\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)\b/,m=>{const d=new Date(today.getFullYear(),today.getMonth(),+m[1]);if(d<today)d.setMonth(d.getMonth()+1);r.date=ymd(d)});
 }
 function dateFrom(mo,day,yr){if(mo<0||day<1||day>31)return false;let y=yr?(+yr<100?2000+ +yr:+yr):today.getFullYear();
  let d=new Date(y,mo,day);if(!yr&&d<today)d=new Date(y+1,mo,day);if(d.getMonth()!=mo)return false;r.date=ymd(d)}

 /* tidy the title */
 let title=s.replace(/\s+/g,' ').replace(/\s+([,.!?])/g,'$1').trim().replace(/^(remind me to|remember to|i need to|need to|todo:?|to do:?)\s+/i,'').replace(/\s+(on|at|by|in|is|for)$/i,'').replace(/^[,.\-–\s]+|[,\-–\s]+$/g,'');
 if(birthday){title=title.replace(/\s+is$/i,'');if(!r.repeat)r.repeat='yearly';if(!/birthday/i.test(title))title+="'s birthday"}
 title=title.charAt(0).toUpperCase()+title.slice(1);
 if(!r.date)r.date=ymd(base);
 if(r.repeat=='weekly'&&!r.date)r.date=ymd(base);
 return{title:title||raw.trim(),...r,...guessCat(raw)};
}
