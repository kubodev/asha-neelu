const {getDefaultConfig}=require("expo/metro-config");
const config=getDefaultConfig(__dirname);
// realtime-js uses the native WebSocket on phones. Resolve its optional Node
// fallback to ws's browser entry so Metro does not bundle Node streams.
config.resolver.resolveRequest=(context,name,platform)=>{
  if(name==="ws")return {type:"sourceFile",filePath:require("path").join(require.resolve("ws/package.json"),"../browser.js")};
  return context.resolveRequest(context,name,platform);
};
module.exports=config;
