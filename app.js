
const KEY = "praxis-bookings-v1";

const seed = {
  business:{name:"Northside Grooming", category:"Dog Groomer", email:"hello@northsidegrooming.co.uk", phone:"01632 123456", address:"24 High Street, Middlesbrough", slug:"northside-grooming"},
  services:[
    {id:"s1",name:"Full Groom",duration:90,price:45,buffer:15,staff:["m1","m2"]},
    {id:"s2",name:"Bath & Brush",duration:45,price:25,buffer:10,staff:["m1","m2"]},
    {id:"s3",name:"Nail Trim",duration:20,price:12,buffer:5,staff:["m1"]}
  ],
  staff:[
    {id:"m1",name:"Sarah Mitchell",role:"Senior Groomer",email:"sarah@northsidegrooming.co.uk"},
    {id:"m2",name:"Dan Wilson",role:"Groomer",email:"dan@northsidegrooming.co.uk"}
  ],
  availability:{
    mon:["09:00","17:00"],tue:["09:00","17:00"],wed:["09:00","17:00"],thu:["09:00","19:00"],fri:["09:00","17:00"],sat:["09:00","15:00"],sun:null
  },
  bookings:[
    {id:"b1",customer:"Emily Carter",email:"emily@example.com",phone:"07700 900111",service:"Full Groom",staff:"Sarah Mitchell",date:"2026-08-14",time:"10:00",price:45,status:"Confirmed",paid:true},
    {id:"b2",customer:"James Brown",email:"james@example.com",phone:"07700 900222",service:"Bath & Brush",staff:"Dan Wilson",date:"2026-08-14",time:"12:30",price:25,status:"Confirmed",paid:true},
    {id:"b3",customer:"Megan Taylor",email:"megan@example.com",phone:"07700 900333",service:"Nail Trim",staff:"Sarah Mitchell",date:"2026-08-15",time:"09:30",price:12,status:"Pending",paid:false},
    {id:"b4",customer:"Oliver Green",email:"oliver@example.com",phone:"07700 900444",service:"Full Groom",staff:"Dan Wilson",date:"2026-08-15",time:"11:00",price:45,status:"Confirmed",paid:true}
  ],
  settings:{reminders:true,onlinePayments:true,autoConfirm:true}
};

let db = JSON.parse(localStorage.getItem(KEY) || "null") || seed;
let state = {view:"dashboard", modal:null, bookingStep:1, booking:{service:null,date:"2026-08-15",time:null,staff:null,customer:{name:"",email:"",phone:""}}};

function save(){localStorage.setItem(KEY,JSON.stringify(db));}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
function money(v){return "£"+Number(v).toFixed(2);}
function initials(name){return name.split(" ").map(x=>x[0]).join("").slice(0,2).toUpperCase();}
function todayISO(){return new Date().toISOString().slice(0,10);}
function fmtDate(s){return new Date(s+"T12:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});}
function fmtTime(s){return s;}
function toast(msg){const x=document.createElement("div");x.className="toast";x.textContent=msg;document.body.appendChild(x);setTimeout(()=>x.remove(),2600);}
function render(){document.getElementById("app").innerHTML = state.view==="booking" ? publicBooking() : dashboard();}

function dashboard(){
  const views={dashboard:"Overview",bookings:"Bookings",calendar:"Calendar",services:"Services",staff:"Staff",availability:"Availability",settings:"Settings"};
  return `<div class="shell"><header class="topbar"><div class="brand">praxis<span>•</span>bookings</div><div class="top-actions"><button class="btn btn-light" onclick="openBooking()">View booking page</button><div class="avatar">${initials(db.business.name)}</div></div></header>
  <div class="layout"><aside class="sidebar"><div class="nav-label">Manage</div><nav class="nav">
  ${nav("dashboard","▦","Dashboard")}${nav("bookings","▤","Bookings")}${nav("calendar","▦","Calendar")}${nav("services","◈","Services")}${nav("staff","●","Staff")}${nav("availability","◷","Availability")}
  <div class="nav-label">Business</div>${nav("settings","⚙","Settings")}
  </nav></aside><main class="main">${viewContent(views[state.view])}</main></div></div>`;
}
function nav(id,icon,label){return `<button class="${state.view===id?"active":""}" onclick="setView('${id}')"><span class="nav-icon">${icon}</span>${label}</button>`}
function viewContent(title){
 if(state.view==="dashboard")return dashboardContent();
 if(state.view==="bookings")return bookingsContent();
 if(state.view==="calendar")return calendarContent();
 if(state.view==="services")return servicesContent();
 if(state.view==="staff")return staffContent();
 if(state.view==="availability")return availabilityContent();
 return settingsContent();
}
function head(ey,title,sub,actions=""){return `<div class="page-head"><div><div class="eyebrow">${ey}</div><h1 class="page-title">${title}</h1><p class="page-sub">${sub}</p></div><div class="actions">${actions}</div></div>`}

function dashboardContent(){
 const upcoming=db.bookings.filter(b=>b.status!=="Cancelled").sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).slice(0,5);
 const confirmed=db.bookings.filter(b=>b.status==="Confirmed").length;
 const revenue=db.bookings.filter(b=>b.paid).reduce((a,b)=>a+b.price,0);
 return head("Friday, 14 August 2026","Good evening 👋","Here's what's happening with your business today.",`<button class="btn btn-primary" onclick="openBooking()">Open booking page</button>`) +
 `<div class="grid stats">
 ${stat("Today's bookings",db.bookings.filter(b=>b.date===todayISO()).length,"+18% vs last Friday")}
 ${stat("Upcoming",db.bookings.filter(b=>b.date>=todayISO()&&b.status!=="Cancelled").length,"Across 2 staff members")}
 ${stat("Revenue booked",money(revenue),"+12.4% this month")}
 ${stat("Confirmation rate",Math.round((confirmed/Math.max(db.bookings.length,1))*100)+"%","Healthy booking flow")}
 </div>
 <div class="grid two" style="margin-top:18px"><div class="card"><div class="card-head"><h2 class="card-title">Upcoming bookings</h2><button class="btn btn-light btn-small" onclick="setView('bookings')">View all</button></div>
 <div class="table-wrap"><table class="table"><thead><tr><th>Customer</th><th>Service</th><th>Date</th><th>Staff</th><th>Status</th><th></th></tr></thead><tbody>${upcoming.map(row).join("")}</tbody></table></div></div>
 <div class="card"><div class="card-head"><h2 class="card-title">Services</h2><button class="btn btn-light btn-small" onclick="setView('services')">Manage</button></div><div class="list">${db.services.map(s=>`<div class="list-row"><div><b>${esc(s.name)}</b><div class="muted">${s.duration} mins · ${money(s.price)}</div></div><b>${db.bookings.filter(b=>b.service===s.name).length}</b></div>`).join("")}</div></div></div>
 <div class="grid three" style="margin-top:18px"><div class="card"><div class="card-head"><h2 class="card-title">Booking page</h2></div><div class="kicker">PUBLIC LINK</div><p><b>praxisbookings.local/${esc(db.business.slug)}</b></p><button class="btn btn-primary" onclick="copyLink()">Copy booking link</button></div><div class="card"><div class="card-head"><h2 class="card-title">Payments</h2></div><div class="price-large">${money(revenue)}</div><p class="muted">Paid through online bookings</p><div class="bar"><span style="width:82%"></span></div></div><div class="card"><div class="card-head"><h2 class="card-title">Quick setup</h2></div><div class="feature-list"><div class="feature"><b>✓</b> Services added</div><div class="feature"><b>✓</b> Staff added</div><div class="feature"><b>✓</b> Availability set</div><div class="feature"><b>✓</b> Booking page live</div></div></div></div>`;
}
function stat(label,value,foot){return `<div class="card"><div class="stat-value">${value}</div><div class="stat-label">${label}</div><div class="stat-foot up">${foot}</div></div>`}
function row(b){return `<tr><td><div class="person"><div class="mini-avatar">${initials(b.customer)}</div><div><b>${esc(b.customer)}</b><div class="muted">${esc(b.email)}</div></div></div></td><td>${esc(b.service)}</td><td>${fmtDate(b.date)}<br><span class="muted">${fmtTime(b.time)}</span></td><td>${esc(b.staff)}</td><td><span class="status ${b.status.toLowerCase()}">${b.status}</span></td><td><button class="btn btn-light btn-small" onclick="bookingDetails('${b.id}')">View</button></td></tr>`}

function bookingsContent(){
 const rows=[...db.bookings].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
 return head("Manage","Bookings","Every appointment, customer and payment in one place.",`<button class="btn btn-primary" onclick="openBooking()">New booking</button>`) +
 `<div class="card"><div class="card-head"><h2 class="card-title">${rows.length} bookings</h2><select class="btn btn-light" onchange="filterBookings(this.value)"><option value="all">All statuses</option><option>Confirmed</option><option>Pending</option><option>Cancelled</option></select></div><div class="table-wrap"><table class="table"><thead><tr><th>Customer</th><th>Service</th><th>Date</th><th>Staff</th><th>Payment</th><th>Status</th><th></th></tr></thead><tbody id="bookingRows">${rows.map(b=>rowFull(b)).join("")}</tbody></table></div></div>`;
}
function rowFull(b){return `<tr data-status="${b.status}"><td><div class="person"><div class="mini-avatar">${initials(b.customer)}</div><div><b>${esc(b.customer)}</b><div class="muted">${esc(b.phone)}</div></div></div></td><td>${esc(b.service)}</td><td>${fmtDate(b.date)}<br><span class="muted">${b.time}</span></td><td>${esc(b.staff)}</td><td>${b.paid?`<span class="status confirmed">Paid ${money(b.price)}</span>`:`<span class="status pending">Unpaid</span>`}</td><td><span class="status ${b.status.toLowerCase()}">${b.status}</span></td><td><button class="btn btn-light btn-small" onclick="bookingDetails('${b.id}')">View</button></td></tr>`}

function calendarContent(){
 const base=new Date("2026-08-10T12:00:00");
 let days="";
 for(let i=0;i<7;i++){let d=new Date(base);d.setDate(base.getDate()+i);let iso=d.toISOString().slice(0,10);let bs=db.bookings.filter(b=>b.date===iso);days+=`<div class="day"><div class="day-head">${d.toLocaleDateString("en-GB",{weekday:"short",day:"numeric"})}</div>${bs.map(b=>`<div class="event" onclick="bookingDetails('${b.id}')"><strong>${b.time} · ${esc(b.customer)}</strong>${esc(b.service)}</div>`).join("")}</div>`}
 return head("Schedule","Calendar","A weekly view of appointments and availability.",`<button class="btn btn-primary" onclick="openBooking()">Add booking</button>`)+`<div class="card"><div class="calendar">${days}</div></div>`;
}
function servicesContent(){
 return head("Business","Services","Set your services, prices, durations and booking buffers.",`<button class="btn btn-primary" onclick="serviceModal()">Add service</button>`)+
 `<div class="grid three">${db.services.map(s=>`<div class="card"><div class="card-head"><h2 class="card-title">${esc(s.name)}</h2><button class="btn btn-light btn-small" onclick="serviceModal('${s.id}')">Edit</button></div><div class="price-large">${money(s.price)}</div><p class="muted">${s.duration} minutes · ${s.buffer} min buffer</p><div class="kicker">STAFF</div><p>${s.staff.map(id=>db.staff.find(x=>x.id===id)?.name).join(", ")}</p><button class="btn btn-danger btn-small" onclick="deleteService('${s.id}')">Delete</button></div>`).join("")}</div>`;
}
function staffContent(){
 return head("Business","Staff","Manage who can take bookings and which services they provide.",`<button class="btn btn-primary" onclick="staffModal()">Add staff member</button>`)+
 `<div class="grid three">${db.staff.map(s=>`<div class="card"><div class="person"><div class="mini-avatar">${initials(s.name)}</div><div><b>${esc(s.name)}</b><div class="muted">${esc(s.role)}</div></div></div><p class="muted">${esc(s.email)}</p><div class="kicker">SERVICES</div><p>${db.services.filter(x=>x.staff.includes(s.id)).map(x=>esc(x.name)).join(", ")||"None"}</p><button class="btn btn-light btn-small" onclick="staffModal('${s.id}')">Edit</button></div>`).join("")}</div>`;
}
function availabilityContent(){
 const days=[["mon","Monday"],["tue","Tuesday"],["wed","Wednesday"],["thu","Thursday"],["fri","Friday"],["sat","Saturday"],["sun","Sunday"]];
 return head("Business","Availability","Control when customers can book appointments.",`<button class="btn btn-primary" onclick="saveAvailability()">Save changes</button>`)+
 `<div class="card"><div class="list">${days.map(([k,n])=>{let v=db.availability[k];return `<div class="switch"><div><b>${n}</b><div class="muted">${v?`${v[0]} – ${v[1]}`:"Closed"}</div></div><div style="display:flex;gap:8px;align-items:center">${v?`<input id="${k}start" type="time" value="${v[0]}"><input id="${k}end" type="time" value="${v[1]}">`:``}<input id="${k}on" type="checkbox" ${v?"checked":""} onchange="toggleDay('${k}',this.checked)"></div></div>`}).join("")}</div></div>`;
}
function settingsContent(){
 return head("Business","Settings","Your business profile, reminders and payment preferences.",`<button class="btn btn-primary" onclick="saveSettings()">Save changes</button>`)+
 `<div class="grid two"><div class="card"><div class="card-head"><h2 class="card-title">Business details</h2></div><div class="form-grid">
 ${field("Business name","businessName",db.business.name)}${field("Category","businessCategory",db.business.category)}${field("Email","businessEmail",db.business.email)}${field("Phone","businessPhone",db.business.phone)}${field("Address","businessAddress",db.business.address,true)}${field("Booking page slug","businessSlug",db.business.slug)}
 </div></div><div class="card"><div class="card-head"><h2 class="card-title">Booking settings</h2></div>
 ${setting("reminders","Automatic reminders","Send booking reminders before appointments.",db.settings.reminders)}
 ${setting("onlinePayments","Online payments","Allow customers to pay when booking.",db.settings.onlinePayments)}
 ${setting("autoConfirm","Auto-confirm","Confirm bookings automatically when a slot is available.",db.settings.autoConfirm)}
 </div></div>`;
}
function field(label,id,value,full=false){return `<div class="field ${full?"full":""}"><label>${label}</label><input id="${id}" value="${esc(value)}"></div>`}
function setting(id,title,sub,on){return `<div class="switch"><div><b>${title}</b><div class="muted">${sub}</div></div><input id="set-${id}" type="checkbox" ${on?"checked":""}></div>`}

function openBooking(){state.view="booking";state.bookingStep=1;state.booking={service:null,date:"2026-08-15",time:null,staff:null,customer:{name:"",email:"",phone:""}};render();}
function publicBooking(){
 const b=db.business;
 if(state.bookingStep===4)return `<div class="public"><header class="public-head"><div class="brand">praxis<span>•</span>bookings</div><button class="btn btn-light" onclick="setView('dashboard')">Business login</button></header><div class="public-wrap"><div class="card success-box"><div class="success-mark">✓</div><div class="eyebrow">Booking confirmed</div><h1 class="page-title">You're all booked in.</h1><p class="page-sub">A confirmation has been prepared for ${esc(state.booking.customer.email)}.</p><div class="card" style="text-align:left;margin-top:22px">${bookingSummary()}</div><button class="btn btn-dark" style="margin-top:18px" onclick="setView('dashboard')">Back to dashboard</button></div></div></div>`;
 const steps=["Service","Date & time","Your details"];
 return `<div class="public"><header class="public-head"><div class="brand">praxis<span>•</span>bookings</div><button class="btn btn-light" onclick="setView('dashboard')">Business login</button></header><div class="public-wrap">
 ${head("Book online",b.name,`${b.category} · ${b.address}`,"")}
 <div class="booking-layout"><div class="card business-card"><div class="eyebrow">Simple booking</div><h2>Choose your appointment</h2><p class="muted">Select a service, pick a time and you're done.</p><div class="feature-list" style="margin-top:22px"><div class="feature"><b>✓</b> Instant confirmation</div><div class="feature"><b>✓</b> Secure online payment</div><div class="feature"><b>✓</b> Helpful reminders</div></div></div>
 <div class="card"><div class="card-head"><h2 class="card-title">${steps[state.bookingStep-1]}</h2><span class="muted">${state.bookingStep}/3</span></div>${bookingStepContent()}</div></div></div></div>`;
}
function bookingStepContent(){
 if(state.bookingStep===1)return `<div>${db.services.map(s=>`<div class="service-card" onclick="chooseService('${s.id}')"><div><div class="service-name">${esc(s.name)}</div><div class="service-meta">${s.duration} mins · ${s.buffer} min buffer</div></div><div class="right"><div class="price">${money(s.price)}</div><button class="btn btn-light btn-small">Select</button></div></div>`).join("")}</div>`;
 if(state.bookingStep===2){
   const s=db.services.find(x=>x.id===state.booking.service);return `<div class="field"><label>Date</label><input id="bookDate" type="date" min="${todayISO()}" value="${state.booking.date}" onchange="setBookDate(this.value)"></div><div style="margin-top:18px"><div class="kicker">AVAILABLE TIMES</div><div class="time-grid" style="margin-top:10px">${availableTimes(s).map(t=>`<button class="time ${state.booking.time===t?"selected":""}" onclick="chooseTime('${t}')">${t}</button>`).join("")||`<div class="empty">No times available for this date.</div>`}</div></div><div class="modal-foot"><button class="btn btn-light" onclick="state.bookingStep=1;render()">Back</button><button class="btn btn-primary" ${state.booking.time?"":"disabled"} onclick="state.bookingStep=3;render()">Continue</button></div>`;
 }
 return `<div class="form-grid">${field("Full name","custName",state.booking.customer.name)}${field("Email","custEmail",state.booking.customer.email)}${field("Phone","custPhone",state.booking.customer.phone)}</div><div class="card" style="margin-top:18px;background:#f7f8fa">${bookingSummary()}</div><div class="modal-foot"><button class="btn btn-light" onclick="state.bookingStep=2;render()">Back</button><button class="btn btn-primary" onclick="confirmBooking()">Confirm & ${db.settings.onlinePayments?"pay":"book"}</button></div>`;
}
function bookingSummary(){const s=db.services.find(x=>x.id===state.booking.service);return `<div><b>${esc(s?.name||"Service")}</b><div class="muted">${fmtDate(state.booking.date)} at ${state.booking.time} · ${money(s?.price||0)}</div><div class="muted">${esc(state.booking.staff||"Staff assigned automatically")}</div></div>`}
function availableTimes(s){
 if(!s)return [];
 const d=new Date(state.booking.date+"T12:00:00"), keys=["sun","mon","tue","wed","thu","fri","sat"], hours=db.availability[keys[d.getDay()]];
 if(!hours)return [];
 const out=[], [sh,sm]=hours[0].split(":").map(Number), [eh,em]=hours[1].split(":").map(Number);
 for(let mins=sh*60+sm;mins+s.duration<=eh*60+em;mins+=30){
   const t=String(Math.floor(mins/60)).padStart(2,"0")+":"+String(mins%60).padStart(2,"0");
   const clash=db.bookings.some(b=>b.date===state.booking.date&&b.time===t&&b.status!=="Cancelled");
   if(!clash)out.push(t);
 }
 return out;
}
function chooseService(id){state.booking.service=id;state.booking.time=null;state.bookingStep=2;render()}
function setBookDate(v){state.booking.date=v;state.booking.time=null;render()}
function chooseTime(t){state.booking.time=t;render()}
function confirmBooking(){
 const name=document.getElementById("custName")?.value.trim(),email=document.getElementById("custEmail")?.value.trim(),phone=document.getElementById("custPhone")?.value.trim();
 if(!name||!email||!phone){toast("Please complete your details.");return}
 const s=db.services.find(x=>x.id===state.booking.service);
 const staffId=s.staff[Math.floor(Math.random()*s.staff.length)];
 const staff=db.staff.find(x=>x.id===staffId);
 const booking={id:"b"+Date.now(),customer:name,email,phone,service:s.name,staff:staff?.name||"Team",date:state.booking.date,time:state.booking.time,price:s.price,status:db.settings.autoConfirm?"Confirmed":"Pending",paid:!!db.settings.onlinePayments};
 db.bookings.push(booking);save();state.booking.customer={name,email,phone};state.booking.staff=booking.staff;state.bookingStep=4;render();
}
function bookingDetails(id){
 const b=db.bookings.find(x=>x.id===id);if(!b)return;
 state.modal=`<div class="modal"><div class="modal-head"><div><div class="eyebrow">Booking</div><h2 style="margin:4px 0">${esc(b.customer)}</h2></div><button class="close" onclick="closeModal()">×</button></div><div class="card" style="box-shadow:none;background:#f7f8fa"><b>${esc(b.service)}</b><p class="muted">${fmtDate(b.date)} at ${b.time}</p><p class="muted">${esc(b.staff)} · ${money(b.price)}</p><p class="muted">${esc(b.email)} · ${esc(b.phone)}</p></div><div class="modal-foot">${b.status!=="Cancelled"?`<button class="btn btn-danger" onclick="cancelBooking('${b.id}')">Cancel booking</button>`:""}<button class="btn btn-dark" onclick="closeModal()">Close</button></div></div>`;showModal();}
function serviceModal(id){
 const s=db.services.find(x=>x.id===id)||{name:"",duration:60,price:0,buffer:10,staff:db.staff.map(x=>x.id)};
 state.modal=`<div class="modal"><div class="modal-head"><div><div class="eyebrow">Service</div><h2 style="margin:4px 0">${id?"Edit":"Add"} service</h2></div><button class="close" onclick="closeModal()">×</button></div><div class="form-grid">${field("Service name","svcName",s.name)}${field("Price (£)","svcPrice",s.price)}${field("Duration (minutes)","svcDuration",s.duration)}${field("Buffer (minutes)","svcBuffer",s.buffer)}<div class="field full"><label>Staff who can provide it</label><div>${db.staff.map(m=>`<label style="display:inline-flex;gap:6px;margin:7px 14px 0 0"><input type="checkbox" class="svcStaff" value="${m.id}" ${s.staff.includes(m.id)?"checked":""}>${esc(m.name)}</label>`).join("")}</div></div></div><div class="modal-foot"><button class="btn btn-light" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveService('${id||""}')">Save service</button></div></div>`;showModal();}
function staffModal(id){
 const s=db.staff.find(x=>x.id===id)||{name:"",role:"",email:""};
 state.modal=`<div class="modal"><div class="modal-head"><div><div class="eyebrow">Team</div><h2 style="margin:4px 0">${id?"Edit":"Add"} staff member</h2></div><button class="close" onclick="closeModal()">×</button></div><div class="form-grid">${field("Name","staffName",s.name)}${field("Role","staffRole",s.role)}${field("Email","staffEmail",s.email)}</div><div class="modal-foot"><button class="btn btn-light" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveStaff('${id||""}')">Save</button></div></div>`;showModal();}
function showModal(){document.body.insertAdjacentHTML("beforeend",`<div class="modal-bg" id="modalBg">${state.modal}</div>`)}
function closeModal(){document.getElementById("modalBg")?.remove();state.modal=null}
function saveService(id){
 const name=document.getElementById("svcName").value.trim(),price=Number(document.getElementById("svcPrice").value),duration=Number(document.getElementById("svcDuration").value),buffer=Number(document.getElementById("svcBuffer").value),staff=[...document.querySelectorAll(".svcStaff:checked")].map(x=>x.value);
 if(!name||!duration){toast("Please enter a service name and duration.");return}
 if(id){Object.assign(db.services.find(x=>x.id===id),{name,price,duration,buffer,staff})}else db.services.push({id:"s"+Date.now(),name,price,duration,buffer,staff});
 save();closeModal();render();toast("Service saved.");
}
function saveStaff(id){
 const name=document.getElementById("staffName").value.trim(),role=document.getElementById("staffRole").value.trim(),email=document.getElementById("staffEmail").value.trim();
 if(!name)return toast("Please enter a name.");
 if(id)Object.assign(db.staff.find(x=>x.id===id),{name,role,email});else db.staff.push({id:"m"+Date.now(),name,role,email});
 save();closeModal();render();toast("Staff member saved.");
}
function deleteService(id){if(confirm("Delete this service?")){db.services=db.services.filter(x=>x.id!==id);save();render();toast("Service deleted.");}}
function cancelBooking(id){const b=db.bookings.find(x=>x.id===id);if(b)b.status="Cancelled";save();closeModal();render();toast("Booking cancelled.");}
function filterBookings(v){document.querySelectorAll("#bookingRows tr").forEach(r=>r.style.display=(v==="all"||r.dataset.status===v)?"":"none")}
function toggleDay(k,on){if(on){const a=document.getElementById(k+"start"),b=document.getElementById(k+"end");if(!a){render();return}}else db.availability[k]=null}
function saveAvailability(){
 const days=["mon","tue","wed","thu","fri","sat","sun"];days.forEach(k=>{const on=document.getElementById(k+"on");if(on?.checked)db.availability[k]=[document.getElementById(k+"start").value,document.getElementById(k+"end").value];else db.availability[k]=null});save();render();toast("Availability updated.");
}
function saveSettings(){
 db.business.name=document.getElementById("businessName").value.trim();db.business.category=document.getElementById("businessCategory").value.trim();db.business.email=document.getElementById("businessEmail").value.trim();db.business.phone=document.getElementById("businessPhone").value.trim();db.business.address=document.getElementById("businessAddress").value.trim();db.business.slug=document.getElementById("businessSlug").value.trim();
 ["reminders","onlinePayments","autoConfirm"].forEach(k=>db.settings[k]=document.getElementById("set-"+k).checked);save();render();toast("Settings saved.");
}
function copyLink(){navigator.clipboard?.writeText(location.href);toast("Booking link copied.");}
function setView(v){state.view=v;render();window.scrollTo(0,0)}
render();
