import "react-native-url-polyfill/auto";
import React,{useEffect,useState,useRef} from "react";
import {View,Text,ScrollView,Pressable,Platform,AppState,Modal} from "react-native";
import {useAudioPlayer,setAudioModeAsync} from "expo-audio";
import * as Notifications from "expo-notifications";
import {Dashboard,messages as message} from "./Dashboard";
import {createClient} from "@supabase/supabase-js";

const url=process.env.EXPO_PUBLIC_SUPABASE_URL,key=process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const db=url && key?createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}):null;
const highPriority=Notifications.AndroidNotificationPriority.HIGH;
const warningChannel="village-water-warnings";
async function ensureChannel(warning){
 if(Platform.OS!=="android")return;
 await Notifications.setNotificationChannelAsync(warning?warningChannel:"water",{
  name:warning?"Water supply warnings":"Village water updates",
  importance:warning?Notifications.AndroidImportance.HIGH:Notifications.AndroidImportance.DEFAULT,
  sound:"default",enableVibrate:true,vibrationPattern:[0,220,100,220]
 });
}
Notifications.setNotificationHandler({handleNotification:async n=>({
 shouldShowBanner:true,shouldShowList:true,shouldPlaySound:true,shouldSetBadge:false,
 priority:n.request.content.data?.warning?highPriority:Notifications.AndroidNotificationPriority.DEFAULT
})});
async function postNotice(warning,body){
 await ensureChannel(warning);
 await Notifications.scheduleNotificationAsync({
  content:{title:warning?"Village water warning":"Supply update",body,sound:"default",data:{warning},
   priority:warning?highPriority:Notifications.AndroidNotificationPriority.DEFAULT},
  trigger:Platform.OS==="android"?{channelId:warning?warningChannel:"water"}:null
 });
}
export default function App(){
 const [row,setRow]=useState(null),[alerts,setAlerts]=useState([]),[note,setNote]=useState(""),[error,setError]=useState("");
 const [tab,setTab]=useState("Water");
 const warningPlayer=useAudioPlayer(require("./assets/warning.wav"));
 const [popup,setPopup]=useState(null);
 const seen=useRef(new Set());
 const nativeAllowed=useRef(false);
 async function playWarning(){
  await setAudioModeAsync({playsInSilentMode:true});
  await warningPlayer.seekTo(0);
  warningPlayer.play();
 }
 function announce(event){
  if(seen.current.has(event.id))return;
  seen.current.add(event.id);
  const body=event.test?"Test warning · Check the phone’s media volume.":message[event.condition];
  const warning=event.condition!=="open";
  setPopup({body,warning});
  if(warning)playWarning().catch(()=>setNote("Audio unavailable. Check media volume and try the test again."));
  if(nativeAllowed.current)postNotice(warning,body).catch(()=>setNote("Phone banners are unavailable. Warnings still appear in the app."));
 }
 useEffect(()=>{
  Notifications.getPermissionsAsync().then(p=>{nativeAllowed.current=p.granted;}).catch(()=>{});
 },[]);
 useEffect(()=>{
  if(!db)return;
  let alive=true,busy=false,again=false,baseline=false;
  const mounted=Date.now();
  async function refresh(){
   if(busy){again=true;return;}
   busy=true;
   try{
    const [latest,history]=await Promise.all([db.from("village_readings").select("*").order("received_at",{ascending:false}).limit(1),db.from("village_readings").select("*").eq("alert",true).order("received_at",{ascending:false}).limit(12)]);
    if(!alive)return;
    if(latest.error||history.error)throw Error();
    setError("");setRow(latest.data[0]);setAlerts(history.data);
    for(const event of [...history.data].reverse()){
     if(!baseline && Date.parse(event.received_at)<mounted)seen.current.add(event.id);
     else if(AppState.currentState!=="background")announce(event);
    }
    baseline=true;
   }catch{if(alive)setError("Connection interrupted. Showing last received readings.");}
   finally{busy=false;if(alive && again){again=false;refresh();}}
  }
  function receive({new:event}){
   if(!alive)return;
   if(event.alert && AppState.currentState!=="background")announce(event);
   refresh();
  }
  const channel=db.channel("village").on("postgres_changes",{event:"INSERT",schema:"public",table:"village_readings"},receive).subscribe(s=>{if(s==="SUBSCRIBED")refresh();});
  refresh();const timer=setInterval(()=>{if(AppState.currentState!=="background")refresh();},4000);
  const resume=AppState.addEventListener("change",s=>{if(s==="active")refresh();});
  return ()=>{alive=false;clearInterval(timer);resume.remove();db.removeChannel(channel);};
 },[warningPlayer]);
 async function enable(){
  try{
   await ensureChannel(true);
   nativeAllowed.current=(await Notifications.requestPermissionsAsync()).granted;
   setNote(nativeAllowed.current?"Phone banners enabled.":"In-app warnings enabled. Allow notifications for phone banners.");
  }catch{setNote("In-app warnings enabled. Check settings for phone banners.");}
  announce({id:"test-"+Date.now(),condition:"cloudy",test:true});
 }
 return <View style={{flex:1,paddingTop:64,backgroundColor:"#fafbf5"}}><View style={{paddingHorizontal:24}}>
 <Text style={{color:"#506951",fontSize:16}}>Malkapuram · Project demo</Text><Text accessibilityRole="header" style={{fontSize:36,fontWeight:"800",marginVertical:10}}>Village water</Text>
 <View accessibilityRole="tablist" style={{flexDirection:"row",gap:8,marginVertical:12}}>
 {["Water","Alerts"].map(name=><Pressable key={name} accessibilityRole="tab" accessibilityState={{selected:tab===name}}
 onPress={()=>setTab(name)} style={{flex:1,padding:12,alignItems:"center",borderRadius:8,backgroundColor:tab===name?"#164e41":"#e3ece5"}}>
 <Text style={{fontSize:19,fontWeight:"700",color:tab===name?"white":"#164e41"}}>{name}</Text></Pressable>)}
 </View></View>
 {popup&&<Modal visible transparent animationType="fade" onRequestClose={()=>setPopup(null)}><View style={{flex:1,justifyContent:"center",backgroundColor:"#10282699"}}><View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={{marginHorizontal:20,marginBottom:12,padding:16,borderRadius:12,backgroundColor:popup.warning?"#ffe1d3":"#dceee1",borderLeftWidth:5,borderColor:popup.warning?"#a34320":"#187a53"}}>
 <Text style={{fontSize:15,fontWeight:"700"}}>{popup.warning?"Water warning":"Supply update"}</Text>
 <Text style={{fontSize:21,fontWeight:"700",marginVertical:4}}>{popup.body}</Text>
 <Pressable accessibilityRole="button" onPress={()=>setPopup(null)} style={{alignSelf:"flex-end",padding:6}}><Text style={{fontWeight:"700"}}>Dismiss</Text></Pressable></View></View></Modal>}
 <ScrollView key={tab} contentContainerStyle={{paddingHorizontal:20,paddingBottom:60}}>
 {!!error&&<Text>{error}</Text>}
 {tab==="Water"?<>
 {row?<Dashboard row={row}/>:<Text style={{fontSize:22}}>{db?"Waiting for the tour…":"Connect Supabase to begin"}</Text>}
 </>:<><Pressable accessibilityRole="button" onPress={enable} style={{padding:16,marginVertical:16,borderRadius:10,backgroundColor:"#164e41"}}><Text style={{color:"white",fontSize:19}}>Enable alerts &amp; test warning sound</Text></Pressable>
 {!!note&&<Text accessibilityLiveRegion="polite">{note}</Text>}<Text style={{fontSize:24,fontWeight:"700"}}>Recent alerts</Text>
 {!alerts.length&&<Text>No alerts received yet.</Text>}{alerts.map(a=><View key={a.id} style={{paddingVertical:10,borderBottomWidth:1,borderColor:"#cfdbce"}}><Text style={{fontSize:19}}>{message[a.condition]}</Text><Text>{new Date(a.received_at).toLocaleString()}</Text></View>)}</>}</ScrollView></View>;
}
