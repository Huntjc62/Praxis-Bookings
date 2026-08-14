import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, updateProfile
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, addDoc, collection,
  query, where, orderBy, getDocs, updateDoc, serverTimestamp,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app=initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getFirestore(app);
const root=document.getElementById("app");

let currentUser=null, business=null, data={services:[],staff:[],bookings:[],availability:[]};
let authMode="login";

const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const money=p=>(Number(p)/100).toLocaleString("en-GB",{style:"currency",currency:"GBP"});
const slug=s=>String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60);
const today=()=>new Date().toISOString().slice(0,10);
const initials=s=>String(s||"").split(" ").map(x=>x[0]).join("").slice(0,2).toUpperCase();

onAuthStateChanged(auth, async user=>{
  currentUser=user;
  if(user){ await loadBusiness(); renderDashboard("overview"); }
  else renderAuth();
});

function renderAuth(){
 root.innerHTML=`<div class="auth-shell"><div class="auth-card">
 <div class="logo">praxis<span>•</span>bookings</div>
 <div class="eyebrow">${authMode==="login"?"BUSINESS LOGIN":"GET STARTED"}</div>
 <h1>${authMode==="login"?"Welcome back":"Create your business account"}</h1>
 <p class="muted">${authMode==="login"?"Sign in to manage bookings, staff and payments.":"Set up your booking business and get your own online booking page."}</p>
 <div id="authError" class="error"></div>
 ${authMode==="signup"?`
 <div class="field"><label>Business name</label><input id="businessName" placeholder="Northside Grooming"></div>
 <div class="field"><label>Business type</label><input id="businessType" placeholder="Dog groomer"></div>`:""}
 <div class="field"><label>Email address</label><input id="email" type="email" placeholder="you@business.co.uk"></div>
 <div class="field"><label>Password</label><input id="password" type="password" placeholder="Minimum 8 characters"></div>
 <button class="btn primary full" id="authBtn">${authMode==="login"?"Log in":"Create account"}</button>
 <button class="link-btn" id="switchAuth">${authMode==="login"?"Don't have an account? Sign up":"Already have an account? Log in"}</button>
 </div></div>`;
 document.getElementById("authBtn").onclick=authMode==="login"?login:signup;
 document.getElementById("switchAuth").onclick=()=>{authMode=authMode==="login"?"signup":"login";renderAuth()};
}
async function login(){
 try{await signInWithEmailAndPassword(auth,email.value.trim(),password.value)}
 catch(e){showAuthError(firebaseError(e))}
}
async function signup(){
 try{
  if(password.value.length<8)throw new Error("Password must be at least 8 characters.");
  const cred=await createUserWithEmailAndPassword(auth,email.value.trim(),password.value);
  await updateProfile(cred.user,{displayName:businessName.value.trim()});
  const businessId=cred.user.uid;
  business={id:businessId,name:businessName.value.trim(),category:businessType.value.trim()||"Local business",
    email:cred.user.email,phone:"",address:"",slug:slug(businessName.value)||businessId};
  await setDoc(doc(db,"businesses",businessId),{...business,ownerId:cred.user.uid,createdAt:serverTimestamp()});
  await setDoc(doc(db,"businesses",businessId,"settings","general"),{
    reminders:true,onlinePayments:true,autoConfirm:true,stripeConnected:false
  });
  await seedBusiness(businessId);
 }catch(e){showAuthError(firebaseError(e))}
}
function showAuthError(x){const el=document.getElementById("authError");if(el)el.textContent=x}
function firebaseError(e){
 const map={"auth/email-already-in-use":"An account with that email already exists.","auth/invalid-email":"Please enter a valid email address.","auth/weak-password":"Use a stronger password.","auth/invalid-credential":"Incorrect email or password."};
 return map[e.code]||e.message||"Something went wrong.";
}
async function seedBusiness(id){
 const s1=await addDoc(collection(db,"businesses",id,"services"),{name:"Standard Appointment",pricePence:2500,duration:60,buffer:10,active:true,createdAt:serverTimestamp()});
 await addDoc(collection(db,"businesses",id,"services"),{name:"Premium Appointment",pricePence:4500,duration:90,buffer:15,active:true,createdAt:serverTimestamp()});
 await addDoc(collection(db,"businesses",id,"staff"),{name:"Business Owner",email:currentUser.email,role:"Owner",createdAt:serverTimestamp()});
 for(let d=0;d<7;d++)await setDoc(doc(db,"businesses",id,"availability",String(d)),{weekday:d,enabled:d!==0,openTime:"09:00",closeTime:d===6?"15:00":"17:00"});
}

async function loadBusiness(){
 const ref=doc(db,"businesses",currentUser.uid), snap=await getDoc(ref);
 if(!snap.exists()){await signOut(auth);return}
 business={id:snap.id,...snap.data()};
 const [services,staff,bookings,availability]=await Promise.all([
  getDocs(collection(db,"businesses",business.id,"services")),
  getDocs(collection(db,"businesses",business.id,"staff")),
  getDocs(query(collection(db,"businesses",business.id,"bookings"),orderBy("createdAt","desc"))),
  getDocs(collection(db,"businesses",business.id,"availability"))
 ]);
 data.services=services.docs.map(x=>({id:x.id,...x.data()}));
 data.staff=staff.docs.map(x=>({id:x.id,...x.data()}));
 data.bookings=bookings.docs.map(x=>({id:x.id,...x.data()}));
 data.availability=availability.docs.map(x=>({id:x.id,...x.data()}));
}

function shell(view,content){
 root.innerHTML=`<header class="top"><div class="logo">praxis<span>•</span>bookings</div><div class="top-right"><button class="btn light" id="publicBtn">View booking page</button><div class="avatar">${initials(business.name)}</div><button class="btn primary" id="logout">Log out</button></div></header>
 <div class="layout"><aside class="side">
 ${nav("overview","▦","Dashboard",view)}${nav("bookings","▤","Bookings",view)}${nav("calendar","▦","Calendar",view)}${nav("services","◈","Services",view)}${nav("staff","●","Staff",view)}${nav("availability","◷","Availability",view)}${nav("settings","⚙","Settings",view)}
 </aside><main class="main">${content}</main></div>`;
 document.getElementById("logout").onclick=()=>signOut(auth);
 document.getElementById("publicBtn").onclick=()=>window.open(`?book=${encodeURIComponent(business.slug)}`,"_blank");
}
function nav(id,icon,label,view){return `<button class="${id===view?"active":""}" data-view="${id}">${icon}<span>${label}</span></button>`}
function renderDashboard(view){
 const c=dashboardContent(view);
 shell(view,c);
 document.querySelectorAll("[data-view]").forEach(x=>x.onclick=()=>renderDashboard(x.dataset.view));
}
function head(k,t,s,action=""){return `<div class="head"><div><div class="eyebrow">${k}</div><h1>${t}</h1><p class="muted">${s}</p></div><div>${action}</div></div>`}
function stat(v,l){return `<div class="card"><div class="stat-value">${v}</div><div class="muted">${l}</div></div>`}

function dashboardContent(view){
 if(view==="overview"){
  const rev=data.bookings.filter(x=>x.paymentStatus==="paid").reduce((a,x)=>a+(x.amountPence||0),0);
  return head("DASHBOARD","Good evening 👋","Your booking business at a glance.",`<button class="btn primary" onclick="window.open('?book=${encodeURIComponent(business.slug)}','_blank')">Open booking page</button>`)
  +`<div class="grid stats">${stat(data.bookings.filter(x=>x.bookingDate===today()).length,"Today's bookings")}${stat(data.bookings.filter(x=>x.status!=="cancelled").length,"Total bookings")}${stat(money(rev),"Paid revenue")}${stat(business.stripeConnected?"Connected":"Not connected","Stripe")}</div>
  <div class="card section"><h2>Recent bookings</h2>${bookingTable(data.bookings.slice(0,10))}</div>`;
 }
 if(view==="bookings")return head("MANAGE","Bookings","Appointments, customers and payment status.",`<button class="btn primary" onclick="window.open('?book=${encodeURIComponent(business.slug)}','_blank')">New booking</button>`)+`<div class="card section">${bookingTable(data.bookings)}</div>`;
 if(view==="services")return servicesView();
 if(view==="staff")return staffView();
 if(view==="availability")return availabilityView();
 if(view==="settings")return settingsView();
 return calendarView();
}
function bookingTable(rows){return `<div class="table-wrap"><table><thead><tr><th>Customer</th><th>Service</th><th>Date</th><th>Staff</th><th>Payment</th><th>Status</th></tr></thead><tbody>${rows.map(x=>`<tr><td><b>${esc(x.customerName)}</b><div class="small">${esc(x.customerEmail)}</div></td><td>${esc(x.serviceName||"Service")}</td><td>${esc(x.bookingDate)}<br>${esc(x.bookingTime)}</td><td>${esc(x.staffName||"Team")}</td><td><span class="status ${x.paymentStatus==="paid"?"paid":"pending"}">${esc(x.paymentStatus||"unpaid")}</span></td><td><span class="status ${x.status}">${esc(x.status)}</span></td></tr>`).join("")}</tbody></table></div>`}
function servicesView(){return head("BUSINESS","Services","Set prices, durations and buffers.",`<button class="btn primary" id="addService">Add service</button>`)+`<div class="grid three">${data.services.map(s=>`<div class="card"><h2>${esc(s.name)}</h2><div class="stat-value">${money(s.pricePence)}</div><p class="muted">${s.duration} mins · ${s.buffer} min buffer</p></div>`).join("")}</div>`}
function staffView(){return head("BUSINESS","Staff","Manage the people who take bookings.",`<button class="btn primary" id="addStaff">Add staff</button>`)+`<div class="grid three">${data.staff.map(s=>`<div class="card"><div class="person"><div class="avatar">${initials(s.name)}</div><div><b>${esc(s.name)}</b><div class="muted">${esc(s.role||"Staff")}</div></div></div><p>${esc(s.email)}</p></div>`).join("")}</div>`}
function availabilityView(){
 const names=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
 return head("BUSINESS","Availability","Choose when customers can book.",`<button class="btn primary" id="saveAvailability">Save</button>`)+`<div class="card">${names.map((n,i)=>{const a=data.availability.find(x=>Number(x.weekday)===i)||{enabled:false,openTime:"09:00",closeTime:"17:00"};return `<div class="availability-row"><b>${n}</b><input id="en${i}" type="checkbox" ${a.enabled?"checked":""}><input id="op${i}" type="time" value="${a.openTime||"09:00"}"><input id="cl${i}" type="time" value="${a.closeTime||"17:00"}"></div>`}).join("")}</div>`;
}
function settingsView(){return head("BUSINESS","Settings","Manage your business profile and payments.",`<button class="btn primary" id="saveBusiness">Save</button>`)+`<div class="card"><div class="formgrid">${field("Business name","bn",business.name)}${field("Category","bc",business.category)}${field("Email","be",business.email)}${field("Phone","bp",business.phone)}<div class="full">${field("Address","ba",business.address)}</div></div><hr><h2>Stripe payments</h2><div class="notice ${business.stripeConnected?"success-notice":""}">${business.stripeConnected?"Stripe is connected and ready to accept payments.":"Connect Stripe so customers can pay online when booking."}</div><button class="btn dark" id="connectStripe">Connect Stripe</button><p class="small">The Stripe Connect onboarding endpoint should be attached here for production. The booking system is designed so payment confirmation comes from Stripe webhooks.</p></div>`}
function field(label,id,value){return `<div class="field"><label>${label}</label><input id="${id}" value="${esc(value||"")}"></div>`}
function calendarView(){
 let start=new Date();start.setHours(12,0,0,0);start.setDate(start.getDate()-start.getDay());
 let html="";for(let i=0;i<7;i++){let d=new Date(start);d.setDate(start.getDate()+i);let iso=d.toISOString().slice(0,10);html+=`<div class="day"><b>${d.toLocaleDateString("en-GB",{weekday:"short",day:"numeric"})}</b>${data.bookings.filter(x=>x.bookingDate===iso).map(x=>`<div class="event"><b>${x.bookingTime}</b> ${esc(x.customerName)}<br>${esc(x.serviceName)}</div>`).join("")}</div>`}
 return head("SCHEDULE","Calendar","Your weekly booking schedule.")+`<div class="card"><div class="calendar">${html}</div></div>`;
}

document.addEventListener("click",async e=>{
 if(e.target.id==="addService"){const name=prompt("Service name");if(!name)return;const price=prompt("Price in £","25");const duration=prompt("Duration in minutes","60");const buffer=prompt("Buffer in minutes","10");await addDoc(collection(db,"businesses",business.id,"services"),{name,pricePence:Math.round(Number(price)*100),duration:Number(duration),buffer:Number(buffer),active:true,createdAt:serverTimestamp()});await loadBusiness();renderDashboard("services")}
 if(e.target.id==="addStaff"){const name=prompt("Staff name");if(!name)return;const email=prompt("Email","");const role=prompt("Role","Staff member");await addDoc(collection(db,"businesses",business.id,"staff"),{name,email,role,createdAt:serverTimestamp()});await loadBusiness();renderDashboard("staff")}
 if(e.target.id==="saveAvailability"){for(let i=0;i<7;i++)await setDoc(doc(db,"businesses",business.id,"availability",String(i)),{weekday:i,enabled:document.getElementById("en"+i).checked,openTime:document.getElementById("op"+i).value,closeTime:document.getElementById("cl"+i).value});await loadBusiness();renderDashboard("availability")}
 if(e.target.id==="saveBusiness"){await updateDoc(doc(db,"businesses",business.id),{name:bn.value,category:bc.value,email:be.value,phone:bp.value,address:ba.value});await loadBusiness();renderDashboard("settings")}
 if(e.target.id==="connectStripe")alert("Connect this button to your Stripe Connect onboarding endpoint. See README for the exact production flow.");
});

async function publicBooking(slugValue){
 const snap=await getDoc(doc(db,"businesses",slugValue));
 if(!snap.exists())throw Error("Booking page not found");
 publicData={id:snap.id,...snap.data()};
 const services=await getDocs(query(collection(db,"businesses",snap.id,"services"),where("active","==",true)));
 publicData.services=services.docs.map(x=>({id:x.id,...x.data()}));
 publicState={step:1,service:null,date:today(),time:null};
 renderPublic();
}
let publicData=null,publicState=null;
function renderPublic(){
 const b=publicData;
 root.innerHTML=`<div class="public"><header class="public-head"><div class="logo">praxis<span>•</span>bookings</div><button class="btn light" onclick="location.href='/'">Business login</button></header><div class="booking-wrap">${head("BOOK ONLINE",b.name,`${b.category||"Local business"} · ${b.address||""}`)}<div class="booking-grid"><div class="card"><h2>Book an appointment</h2><p class="muted">Choose a service, pick a time and complete your details.</p><div class="feature-list"><p>✓ Secure online payment when Stripe is connected</p><p>✓ Instant booking confirmation</p><p>✓ Booking reminders</p></div></div><div class="card">${publicState.step===1?publicServices():publicState.step===2?publicTimes():publicDetails()}</div></div></div></div>`;
}
function publicServices(){return `<h2>Choose a service</h2>${publicData.services.map(s=>`<div class="service" onclick="publicState.service=publicData.services.find(x=>x.id==='${s.id}');publicState.step=2;renderPublic()"><div><b>${esc(s.name)}</b><div class="small">${s.duration} minutes</div></div><b>${money(s.pricePence)}</b></div>`).join("")}`}
async function publicTimes(){
 const d=new Date(publicState.date+"T12:00:00"), av=await getDoc(doc(db,"businesses",publicData.id,"availability",String(d.getDay())));
 const a=av.exists()?av.data():null;let slots=[];
 if(a?.enabled){const [sh,sm]=a.openTime.split(":").map(Number),[eh,em]=a.closeTime.split(":").map(Number);for(let m=sh*60+sm;m+publicState.service.duration<=eh*60+em;m+=30)slots.push(String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0"))}
 const q=await getDocs(query(collection(db,"businesses",publicData.id,"bookings"),where("bookingDate","==",publicState.date),where("status","in",["pending","confirmed"])));
 const taken=q.docs.map(x=>x.data().bookingTime);slots=slots.filter(x=>!taken.includes(x));
 return `<h2>Choose a date & time</h2><div class="field"><label>Date</label><input id="pubDate" type="date" min="${today()}" value="${publicState.date}"></div><div class="times">${slots.map(t=>`<button class="time ${publicState.time===t?"selected":""}" onclick="publicState.time='${t}';renderPublic()">${t}</button>`).join("")||"<p class='muted'>No availability on this date.</p>"}</div><div class="actions-bottom"><button class="btn light" onclick="publicState.step=1;renderPublic()">Back</button>${publicState.time?`<button class="btn primary" onclick="publicState.step=3;renderPublic()">Continue</button>`:""}</div>`;
}
function publicDetails(){return `<h2>Your details</h2>${field("Full name","pname","")}${field("Email","pemail","")}${field("Phone","pphone","")}<div class="summary"><b>${esc(publicState.service.name)}</b><div>${publicState.date} at ${publicState.time} · ${money(publicState.service.pricePence)}</div></div><button class="btn light" onclick="publicState.step=2;renderPublic()">Back</button><button class="btn primary" id="confirmPublic">Continue to payment</button>`}
document.addEventListener("change",e=>{if(e.target.id==="pubDate"){publicState.date=e.target.value;publicState.time=null;renderPublic()}});

document.addEventListener("click",async e=>{
 if(e.target.id==="confirmPublic"){
  if(!pname.value||!pemail.value){alert("Please enter your name and email.");return}
  const staffSnap=await getDocs(collection(db,"businesses",publicData.id,"staff"));const staff=staffSnap.docs[0];
  const bookingRef=await addDoc(collection(db,"businesses",publicData.id,"bookings"),{
   serviceId:publicState.service.id,serviceName:publicState.service.name,staffId:staff?.id||"",staffName:staff?.data().name||"Team",
   customerName:pname.value,customerEmail:pemail.value,customerPhone:pphone.value,
   bookingDate:publicState.date,bookingTime:publicState.time,amountPence:publicState.service.pricePence,
   status:business?.stripeConnected?"pending":"confirmed",paymentStatus:"unpaid",createdAt:serverTimestamp()
  });
  // IMPORTANT: real Stripe Checkout must be created by a trusted server/Cloud Function.
  // The browser never receives a Stripe secret key.
  alert("Booking created. In the production Stripe flow this button will create a Stripe Checkout Session on the server and redirect the customer to Stripe.");
  location.href=`/?book=${encodeURIComponent(publicData.slug)}`;
 }
});

async function init(){
 const q=new URLSearchParams(location.search);
 if(q.get("book")){try{await publicBooking(q.get("book"))}catch(e){root.innerHTML=`<div class="center"><div class="card"><h1>Booking page not found</h1><p>${esc(e.message)}</p></div></div>`}}
}
init();