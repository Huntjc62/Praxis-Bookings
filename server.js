import express from "express";
import session from "express-session";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import Stripe from "stripe";
import dotenv from "dotenv";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const db = new Database("praxis.db");
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 email TEXT UNIQUE NOT NULL,
 password_hash TEXT NOT NULL,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS businesses (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 name TEXT NOT NULL,
 category TEXT DEFAULT 'Local business',
 email TEXT,
 phone TEXT,
 address TEXT,
 slug TEXT UNIQUE NOT NULL,
 stripe_account_id TEXT,
 stripe_connected INTEGER DEFAULT 0,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS services (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 business_id INTEGER NOT NULL,
 name TEXT NOT NULL,
 price_pence INTEGER NOT NULL,
 duration INTEGER NOT NULL,
 buffer INTEGER DEFAULT 0,
 active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS staff (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 business_id INTEGER NOT NULL,
 name TEXT NOT NULL,
 email TEXT,
 role TEXT
);
CREATE TABLE IF NOT EXISTS bookings (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 business_id INTEGER NOT NULL,
 service_id INTEGER NOT NULL,
 staff_id INTEGER,
 customer_name TEXT NOT NULL,
 customer_email TEXT NOT NULL,
 customer_phone TEXT,
 booking_date TEXT NOT NULL,
 booking_time TEXT NOT NULL,
 amount_pence INTEGER NOT NULL,
 status TEXT DEFAULT 'pending',
 payment_status TEXT DEFAULT 'unpaid',
 stripe_session_id TEXT,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS availability (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 business_id INTEGER NOT NULL,
 weekday INTEGER NOT NULL,
 open_time TEXT,
 close_time TEXT,
 enabled INTEGER DEFAULT 1,
 UNIQUE(business_id, weekday)
);
`);

function slugify(v){return v.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60);}
function requireAuth(req,res,next){if(!req.session.userId)return res.status(401).json({error:"Not signed in"});next();}
function getBusiness(userId){return db.prepare("SELECT * FROM businesses WHERE user_id=?").get(userId);}
function seedBusiness(businessId){
  const exists=db.prepare("SELECT COUNT(*) c FROM services WHERE business_id=?").get(businessId).c;
  if(!exists){
    db.prepare("INSERT INTO services(business_id,name,price_pence,duration,buffer) VALUES(?,?,?,?,?)").run(businessId,"Standard Appointment",2500,60,10);
    db.prepare("INSERT INTO services(business_id,name,price_pence,duration,buffer) VALUES(?,?,?,?,?)").run(businessId,"Premium Appointment",4500,90,15);
    db.prepare("INSERT INTO staff(business_id,name,email,role) VALUES(?,?,?,?)").run(businessId,"Business Owner","", "Owner");
    for(let d=1;d<=6;d++) db.prepare("INSERT OR IGNORE INTO availability(business_id,weekday,open_time,close_time,enabled) VALUES(?,?,?,?,1)").run(businessId,d,"09:00",d===6?"15:00":"17:00");
    db.prepare("INSERT OR IGNORE INTO availability(business_id,weekday,enabled) VALUES(?,0,0)").run(businessId);
  }
}

/* Stripe webhook must receive the raw body before express.json(). */
app.post("/api/stripe/webhook", express.raw({type:"application/json"}), (req,res)=>{
  if(!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(400).send("Stripe webhook not configured");
  try{
    const event=stripe.webhooks.constructEvent(req.body,req.headers["stripe-signature"],process.env.STRIPE_WEBHOOK_SECRET);
    if(event.type==="checkout.session.completed"){
      const session=event.data.object;
      const bookingId=Number(session.metadata?.booking_id);
      if(bookingId){
        db.prepare("UPDATE bookings SET payment_status='paid',status='confirmed' WHERE id=?").run(bookingId);
      }
    }
    if(event.type==="checkout.session.expired"){
      const session=event.data.object;
      const bookingId=Number(session.metadata?.booking_id);
      if(bookingId) db.prepare("UPDATE bookings SET payment_status='expired',status='cancelled' WHERE id=? AND payment_status='unpaid'").run(bookingId);
    }
    res.json({received:true});
  }catch(e){res.status(400).send(`Webhook Error: ${e.message}`);}
});

app.use(express.json());
app.use(express.static(path.join(__dirname,"public")));
app.use(session({
  secret:process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
  resave:false,saveUninitialized:false,
  cookie:{httpOnly:true,sameSite:"lax",secure:false,maxAge:1000*60*60*24*14}
}));

app.post("/api/auth/signup",(req,res)=>{
  const {email,password,businessName,category}=req.body;
  if(!email||!password||password.length<8||!businessName) return res.status(400).json({error:"Business name, email and a password of at least 8 characters are required."});
  try{
    const hash=bcrypt.hashSync(password,12);
    const info=db.prepare("INSERT INTO users(email,password_hash) VALUES(?,?)").run(email.toLowerCase().trim(),hash);
    let slug=slugify(businessName), n=1;
    while(db.prepare("SELECT 1 FROM businesses WHERE slug=?").get(slug)){slug=`${slugify(businessName)}-${n++}`;}
    const biz=db.prepare("INSERT INTO businesses(user_id,name,category,email,slug) VALUES(?,?,?,?,?)").run(info.lastInsertRowid,businessName,category||"Local business",email,slug);
    seedBusiness(biz.lastInsertRowid);
    req.session.userId=info.lastInsertRowid;
    res.json({ok:true});
  }catch(e){res.status(400).json({error:e.message.includes("UNIQUE")?"An account with that email already exists.":"Unable to create account."});}
});

app.post("/api/auth/login",(req,res)=>{
  const u=db.prepare("SELECT * FROM users WHERE email=?").get(String(req.body.email||"").toLowerCase().trim());
  if(!u||!bcrypt.compareSync(req.body.password||"",u.password_hash)) return res.status(401).json({error:"Incorrect email or password."});
  req.session.userId=u.id;res.json({ok:true});
});
app.post("/api/auth/logout",(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get("/api/auth/me",(req,res)=>{
  if(!req.session.userId)return res.json({signedIn:false});
  const b=getBusiness(req.session.userId);res.json({signedIn:true,business:b});
});

app.get("/api/dashboard",requireAuth,(req,res)=>{
  const b=getBusiness(req.session.userId);
  const services=db.prepare("SELECT * FROM services WHERE business_id=? AND active=1 ORDER BY id DESC").all(b.id);
  const staff=db.prepare("SELECT * FROM staff WHERE business_id=? ORDER BY id").all(b.id);
  const bookings=db.prepare(`
    SELECT bk.*,s.name service_name,st.name staff_name
    FROM bookings bk JOIN services s ON s.id=bk.service_id
    LEFT JOIN staff st ON st.id=bk.staff_id
    WHERE bk.business_id=? ORDER BY bk.booking_date,bk.booking_time
  `).all(b.id);
  const availability=db.prepare("SELECT * FROM availability WHERE business_id=? ORDER BY weekday").all(b.id);
  res.json({business:b,services,staff,bookings,availability});
});

app.post("/api/services",requireAuth,(req,res)=>{
  const b=getBusiness(req.session.userId);const {name,price,duration,buffer}=req.body;
  const info=db.prepare("INSERT INTO services(business_id,name,price_pence,duration,buffer) VALUES(?,?,?,?,?)").run(b.id,name,Math.round(Number(price)*100),Number(duration),Number(buffer||0));
  res.json({id:info.lastInsertRowid});
});
app.post("/api/staff",requireAuth,(req,res)=>{
  const b=getBusiness(req.session.userId);const {name,email,role}=req.body;
  const info=db.prepare("INSERT INTO staff(business_id,name,email,role) VALUES(?,?,?,?)").run(b.id,name,email||"",role||"");
  res.json({id:info.lastInsertRowid});
});
app.post("/api/business",requireAuth,(req,res)=>{
  const b=getBusiness(req.session.userId);
  const {name,category,email,phone,address}=req.body;
  db.prepare("UPDATE businesses SET name=?,category=?,email=?,phone=?,address=? WHERE id=?").run(name,category,email,phone,address,b.id);
  res.json({ok:true});
});
app.post("/api/availability",requireAuth,(req,res)=>{
  const b=getBusiness(req.session.userId);
  const rows=req.body.rows||[];
  const tx=db.transaction(()=>rows.forEach(x=>{
    db.prepare(`INSERT INTO availability(business_id,weekday,open_time,close_time,enabled) VALUES(?,?,?,?,?)
      ON CONFLICT(business_id,weekday) DO UPDATE SET open_time=excluded.open_time,close_time=excluded.close_time,enabled=excluded.enabled`)
      .run(b.id,x.weekday,x.open_time||null,x.close_time||null,x.enabled?1:0);
  }));
  tx();res.json({ok:true});
});

/* Public booking data */
app.get("/api/public/:slug",(req,res)=>{
  const b=db.prepare("SELECT id,name,category,email,phone,address,slug,stripe_connected FROM businesses WHERE slug=?").get(req.params.slug);
  if(!b)return res.status(404).json({error:"Business not found"});
  const services=db.prepare("SELECT id,name,price_pence,duration,buffer FROM services WHERE business_id=? AND active=1").all(b.id);
  const staff=db.prepare("SELECT id,name,role FROM staff WHERE business_id=?").all(b.id);
  const availability=db.prepare("SELECT * FROM availability WHERE business_id=?").all(b.id);
  res.json({business:b,services,staff,availability});
});

app.get("/api/public/:slug/slots",(req,res)=>{
  const b=db.prepare("SELECT * FROM businesses WHERE slug=?").get(req.params.slug);
  if(!b)return res.status(404).json({error:"Business not found"});
  const service=db.prepare("SELECT * FROM services WHERE id=? AND business_id=? AND active=1").get(req.query.service,b.id);
  if(!service)return res.status(400).json({error:"Service not found"});
  const date=req.query.date;const d=new Date(date+"T12:00:00");const weekday=d.getDay();
  const av=db.prepare("SELECT * FROM availability WHERE business_id=? AND weekday=?").get(b.id,weekday);
  if(!av||!av.enabled)return res.json({slots:[]});
  const [sh,sm]=av.open_time.split(":").map(Number),[eh,em]=av.close_time.split(":").map(Number);
  const existing=db.prepare("SELECT booking_time,service_id FROM bookings WHERE business_id=? AND booking_date=? AND status IN ('pending','confirmed')").all(b.id,date);
  const slots=[];
  for(let m=sh*60+sm;m+service.duration<=eh*60+em;m+=30){
    const time=String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0");
    if(!existing.some(x=>x.booking_time===time))slots.push(time);
  }
  res.json({slots});
});

/* Create a booking. Stripe Checkout is only created if Stripe is configured. */
app.post("/api/public/:slug/book",(req,res)=>{
  const b=db.prepare("SELECT * FROM businesses WHERE slug=?").get(req.params.slug);
  if(!b)return res.status(404).json({error:"Business not found"});
  const {serviceId,date,time,customerName,customerEmail,customerPhone}=req.body;
  const service=db.prepare("SELECT * FROM services WHERE id=? AND business_id=? AND active=1").get(serviceId,b.id);
  if(!service)return res.status(400).json({error:"Service not found"});
  if(!customerName||!customerEmail||!date||!time)return res.status(400).json({error:"Please complete all required details."});
  const clash=db.prepare("SELECT id FROM bookings WHERE business_id=? AND booking_date=? AND booking_time=? AND status IN ('pending','confirmed')").get(b.id,date,time);
  if(clash)return res.status(409).json({error:"That time has just been booked. Please choose another slot."});
  const staff=db.prepare("SELECT * FROM staff WHERE business_id=? ORDER BY id LIMIT 1").get(b.id);
  const info=db.prepare(`INSERT INTO bookings(business_id,service_id,staff_id,customer_name,customer_email,customer_phone,booking_date,booking_time,amount_pence,status,payment_status)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(b.id,service.id,staff?.id||null,customerName,customerEmail,customerPhone||"",date,time,service.price_pence,"pending","unpaid");
  const bookingId=info.lastInsertRowid;
  if(stripe && b.stripe_account_id && b.stripe_connected){
    const checkout=stripe.checkout.sessions.create({
      mode:"payment",
      line_items:[{price_data:{currency:"gbp",product_data:{name:service.name},unit_amount:service.price_pence},quantity:1}],
      customer_email:customerEmail,
      success_url:`${process.env.APP_URL||"http://localhost:3000"}/booking-success.html?booking=${bookingId}`,
      cancel_url:`${process.env.APP_URL||"http://localhost:3000"}/booking-cancelled.html?booking=${bookingId}`,
      metadata:{booking_id:String(bookingId),business_id:String(b.id)},
      payment_intent_data:{metadata:{booking_id:String(bookingId),business_id:String(b.id)}},
    });
    // For a real marketplace, this is where Stripe Connect destination/transfer
    // parameters would be added after the business completes Connect onboarding.
    checkout.then(s=>{db.prepare("UPDATE bookings SET stripe_session_id=? WHERE id=?").run(s.id,bookingId);res.json({checkoutUrl:s.url,paymentRequired:true});})
      .catch(e=>res.status(500).json({error:"Stripe could not create checkout: "+e.message}));
  }else{
    db.prepare("UPDATE bookings SET status='confirmed' WHERE id=?").run(bookingId);
    res.json({paymentRequired:false,bookingId});
  }
});

app.get("/api/booking/:id",(req,res)=>{
  const b=db.prepare(`SELECT bk.*,s.name service_name,bs.name business_name FROM bookings bk
    JOIN services s ON s.id=bk.service_id JOIN businesses bs ON bs.id=bk.business_id WHERE bk.id=?`).get(req.params.id);
  if(!b)return res.status(404).json({error:"Booking not found"});res.json(b);
});

app.listen(process.env.PORT||3000,()=>console.log(`Praxis Bookings running on http://localhost:${process.env.PORT||3000}`));
