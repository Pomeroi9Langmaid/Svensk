function chunks(text,max=450){const out=[];let rest=String(text||'').trim();while(rest){if(rest.length<=max){out.push(rest);break}let cut=rest.lastIndexOf(' ',max);if(cut<100)cut=max;out.push(rest.slice(0,cut));rest=rest.slice(cut).trim()}return out}
module.exports=async(req,res)=>{
  if(req.method!=='POST')return res.status(405).json({error:'POST required'});
  const text=String(req.body?.text||'').trim();
  if(!text)return res.status(400).json({error:'Text required'});
  try{
    const parts=chunks(text).slice(0,25);
    const translated=[];
    for(const part of parts){
      const url=`https://api.mymemory.translated.net/get?q=${encodeURIComponent(part)}&langpair=sv|en`;
      const response=await fetch(url);
      if(!response.ok)throw new Error('Translation service unavailable');
      const data=await response.json();
      translated.push(data.responseData?.translatedText||part);
    }
    res.setHeader('Cache-Control','no-store');
    res.status(200).json({translation:translated.join('\n\n')});
  }catch(error){res.status(502).json({error:'Translation unavailable'})}
};