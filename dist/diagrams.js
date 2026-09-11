// Exact schematic symbols, authored as SVG; colours/shapes follow guide pp.59,72–78.
// Descriptions only describe the displayed stimulus; they never give the answer.
export const DIAGRAMS={
 A077:{type:'cones',directions:['up','up'],alt:'上、下兩個黑色圓錐，錐尖都向上'},
 A078:{type:'cones',directions:['down','down'],alt:'上、下兩個黑色圓錐，錐尖都向下'},
 A079:{type:'cones',directions:['up','down'],alt:'上錐尖向上，下錐尖向下，兩底相對'},
 A080:{type:'cones',directions:['down','up'],alt:'上錐尖向下，下錐尖向上，兩尖相對'},
 A108:{type:'lights',colours:['red','red'],alt:'同一垂直線上兩盞紅色環照燈'},
 A109:{type:'lights',colours:['red','white','red'],alt:'垂直環照燈從上到下為紅、白、紅'},
 A110:{type:'lights',colours:['red','red','red'],alt:'同一垂直線上三盞紅色環照燈'},
 A111:{type:'lights',colours:['green','white'],alt:'垂直環照燈，上綠下白'},
 A112:{type:'lights',colours:['red','white'],alt:'垂直環照燈，上紅下白'},
 A113:{type:'lights',colours:['white','red'],alt:'垂直環照燈，上白下紅'},
 A115:{type:'shapes',shapes:['ball','diamond','ball'],alt:'垂直黑色號型，從上到下是球、菱形、球'},
 A116:{type:'shapes',shapes:['ball','ball','ball'],alt:'三個黑球在同一垂直線上'},
 A117:{type:'shapes',shapes:['ball'],alt:'一個黑色球體'}
};
export function diagramHTML(id){
 const d=DIAGRAMS[id];if(!d)return '';
 const count=(d.colours||d.shapes||d.directions).length,step=64,top=(240-(count-1)*step)/2;
 let symbols='';
 if(d.type==='lights')symbols=d.colours.map((c,n)=>`<circle cx="130" cy="${top+n*step}" r="22" fill="${{red:'#ff4f50',white:'#fffbea',green:'#42df86'}[c]}" stroke="#ffffff55" stroke-width="3"/><text x="178" y="${top+n*step+5}" fill="#dee7ea" font-size="15">${{red:'紅',white:'白',green:'綠'}[c]}</text>`).join('');
 if(d.type==='shapes')symbols=d.shapes.map((s,n)=>s==='ball'?`<circle cx="150" cy="${top+n*step}" r="23" fill="#102331"/>`:`<path d="M150 ${top+n*step-27} L176 ${top+n*step} L150 ${top+n*step+27} L124 ${top+n*step}Z" fill="#102331"/>`).join('');
 if(d.type==='cones')symbols=d.directions.map((dir,n)=>{const y=top+n*step;return `<path d="${dir==='up'?`M150 ${y-25} L121 ${y+23} L179 ${y+23}Z`:`M121 ${y-23} L179 ${y-23} L150 ${y+25}Z`}" fill="#102331"/>`;}).join('');
 return `<figure class="signal-figure ${d.type==='lights'?'night':''}"><svg viewBox="0 0 300 240" role="img" aria-label="${d.alt}"><title>${d.alt}</title>${symbols}</svg><figcaption>${d.type==='lights'?'識別燈示意，並非整套航行燈':d.type==='cones'?'浮標頂標示意':'日間號型示意'} · 比例僅供辨認</figcaption></figure>`;
}
