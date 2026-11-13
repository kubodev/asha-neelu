import React from "react";
import {View,Text,StyleSheet} from "react-native";

export const messages={open:"Water supply is open",held:"Water supply is on hold",cloudy:"Supply closed · Cloudy water",low_chlorine:"Supply closed · Low chlorine",high_chlorine:"Supply closed · High chlorine"};
const number=(v,unit,digits=0)=>v==null?"—":Number(v).toLocaleString(undefined,{maximumFractionDigits:digits})+" "+unit;
const on=v=>v==null?"—":v?"On":"Off";
function Card({title,children}){
 return <View style={s.card}><Text style={s.title}>{title}</Text>{children}</View>;
}
function Metrics({items}){
 return items.map(([label,value])=><View key={label} style={s.line}><Text style={s.label}>{label}</Text><Text style={s.value}>{value}</Text></View>);
}
function Level({title,pct,litres,capacity}){
 return <View style={{marginTop:12}}><View style={s.line}><Text style={s.label}>{title}</Text><Text style={s.value}>{pct}%</Text></View>
 <View style={s.track}><View style={{width:pct+"%",height:10,backgroundColor:"#208984"}}/></View>
 <Text style={s.caption}>{number(litres,"L")} / {number(capacity,"L")}</Text></View>;
}
export function Dashboard({row}){
 const t=row.stats||{};
 return <>
 <View style={[s.hero,row.condition!=="open"&&{backgroundColor:"#873e2f"}]}>
 <Text style={{color:"#e0eee4",fontSize:15}}>Household supply</Text><Text style={s.heroTitle}>{messages[row.condition]}</Text>
 <Text style={{color:"white",fontSize:16}}>Updated {new Date(row.received_at).toLocaleTimeString()}</Text></View>
 <Card title="Water in storage"><Level title="Main tank" pct={row.main_pct} litres={t.main??row.main_pct*100} capacity={10000}/>
 <Level title="Collection tank" pct={row.lower_pct} litres={t.lower??row.lower_pct*30} capacity={3000}/>
 <Metrics items={[["Overflow now",t.overflowing==null?"—":t.overflowing?"Flowing":"Stopped"],["Overflow this run",number(t.overflow,"L")]]}/></Card>
 <Card title="Sun & electricity"><Metrics items={[
 ["Simulated sunlight",t.solar==null?"—":t.solar===0?"No sun":t.solar>=75?"Sunny":"Partial sun"],
 ["Sun available",number(t.solar,"%")],["Solar power now",number(t.kw,"kW",2)],["Energy this run",number(t.kwh,"kWh",2)],["Power in use",number(t.used,"kW",2)],["Streetlights on",t.lights??"—"]]}/></Card>
 <Card title="Pumps & water flow"><Metrics items={[["Intake pump",on(t.pump)],["Pond aerators",on(t.aerators)],["Public tap",on(t.tap)],["River intake",number(t.river,"L/min")],["Filter inlet",number(t.inlet,"L/min")],["Water to homes",number(t.homes,"L/min")],["Delivered this run",number(t.delivered,"L")]]}/></Card>
 <Card title="Water checks"><Metrics items={[["Free chlorine",number(row.chlorine,"mg/L",2)],["Cloudiness",number(t.turbidity,"NTU",2)],["pH",t.ph??"—"],["Level sensor",t.sensor==null?"—":t.sensor?"Online":"Offline"],["Pump protection",t.dry==null?"—":t.dry?"Dry intake alarm":"Ready"]]}/></Card>
 {!row.stats&&<Text style={s.caption}>Waiting for extended readings from the updated tour.</Text>}</>;
}
const s=StyleSheet.create({
 hero:{padding:20,borderRadius:18,backgroundColor:"#135c53"},heroTitle:{fontSize:29,fontWeight:"800",color:"white",marginVertical:6},
 card:{marginTop:14,backgroundColor:"white",borderWidth:1,borderColor:"#d7e3d9",borderRadius:16,padding:17},
 title:{fontSize:22,fontWeight:"700",color:"#173c34"},line:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingVertical:7,gap:8},
 label:{fontSize:16,color:"#465d53",flexShrink:1},value:{fontSize:18,fontWeight:"700",color:"#163c33"},track:{height:10,borderRadius:5,overflow:"hidden",backgroundColor:"#e1ece4"},
 caption:{fontSize:14,color:"#476559",marginVertical:5}
});
