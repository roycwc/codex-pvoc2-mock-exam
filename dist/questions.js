import {A_ROWS} from './questions-a.js';
import {B_ROWS} from './questions-b.js';
export const BANK_VERSION='2026-09-10.2';
export const CHECKED='2026-09-10';
export const PARTS={A:'甲部・航駛、船藝及安全',B:'乙部・輪機知識'};
export const SOURCES={
  guide:{title:'海事處《遊樂船隻二級操作人證明書考試手冊》',edition:'2021 年 5 月版',url:'https://www.mardep.gov.hk/filemanager/tc/share/pub-services/pdf/pvoc_guide_c.pdf',description:'甲部航駛、船藝、安全及乙部輪機的知識依據。每題連結到支持答案的印刷頁及實際 PDF 頁。'},
  sampleA:{title:'海事處甲部官方模擬試卷及答案',edition:'官方公開樣本・40 題',url:'https://www.mardep.gov.hk/filemanager/tc/share/pub-services/pdf/PVOC_exam_A_c.pdf',description:'核對航海計算、燈號、浮標、避碰及船藝的出題方向；本站題目為自編。'},
  sampleB:{title:'海事處乙部官方模擬試卷及答案',edition:'官方公開樣本・40 題',url:'https://www.mardep.gov.hk/filemanager/tc/share/pub-services/pdf/PVOC_exam_B_c.pdf',description:'核對輪機原理、故障、電力及防火的出題方向。「樣本考點」指相同知識點出現於此公開樣本。'},
  rules:{title:'海事處《遊樂船隻操作人合格證明書考試規則》',edition:'2025 年 6 月版',url:'https://www.mardep.gov.hk/filemanager/tc/share/pub-services/pdf/examrules_ploc_c.pdf',description:'第 7.1 節為考試形式；第 8.1 節列甲部（1）–（14）及乙部（15）–（21）考綱。'},
  peak:{title:'高峰進修學院《考試指南》',edition:'2026 年 9 月 1 日起適用',url:'https://www.peak.edu.hk/exam/doc/md_ExamHandbook_chi_202609.pdf',description:'甲、乙部各 40 題、45 分鐘、60% 合格，兩部須分別合格並在兩年內通過。正式試題及答案不公開。'}
};
export const CATEGORIES=[
  {id:'a_handling',part:'A',name:'操船・靠離泊',syllabus:'（1）小型船特性及限制'},
  {id:'a_anchor',part:'A',name:'錨泊・爬錨',syllabus:'（2）錨泊'},
  {id:'a_checks',part:'A',name:'啟航・止航檢查',syllabus:'（3）安全檢查'},
  {id:'a_chart',part:'A',name:'海圖・航向・計算',syllabus:'（4）海圖、定位及預算抵達時間'},
  {id:'a_tides',part:'A',name:'潮汐・安全水深',syllabus:'（5）潮汐及潮流'},
  {id:'a_fog',part:'A',name:'霧航・有限能見度',syllabus:'（6）有限能見度航行'},
  {id:'a_local',part:'A',name:'浮標・香港水域',syllabus:'（7）本地知識及航標'},
  {id:'a_colregs',part:'A',name:'避碰・燈號・號型',syllabus:'（8）國際海上避碰規則'},
  {id:'a_equipment',part:'A',name:'救生・安全設備',syllabus:'（9）安全設備'},
  {id:'a_vhf',part:'A',name:'VHF・通訊',syllabus:'（10）無線電話'},
  {id:'a_services',part:'A',name:'海事處・航海通告',syllabus:'（11）海事處服務'},
  {id:'a_weather',part:'A',name:'氣象・風浪',syllabus:'（12）暴風信號及氣象'},
  {id:'a_emergency',part:'A',name:'應變・穩性・墮海',syllabus:'（13）緊急事故及穩性'},
  {id:'a_reports',part:'A',name:'事故報告',syllabus:'（14）報告意外'},
  {id:'basic',part:'B',name:'引擎原理',syllabus:'（15）輪機構造和功能'},
  {id:'systems',part:'B',name:'燃油・冷卻・傳動',syllabus:'（15）輪機構造和功能'},
  {id:'operation',part:'B',name:'啟動・在航操作',syllabus:'（15）啟停／（16）在航職責'},
  {id:'electrical',part:'B',name:'電池・電力',syllabus:'（17）蓄電池和電氣設備'},
  {id:'faults',part:'B',name:'故障判斷',syllabus:'（18）故障檢修和補救'},
  {id:'maintenance',part:'B',name:'保養・甲板設備',syllabus:'（19）保養／（20）甲板設備'},
  {id:'safety',part:'B',name:'防火・石油氣',syllabus:'（21）滅火與防火'}
];
function parse(raw,part){return raw.trim().split('\n').filter(Boolean).map((line,index)=>{
  const [category,page,stem,correct,b,c,d,explanation,sample]=line.split('|');
  const choices=[correct,b,c,d],shift=index%4;
  return {id:`${part}${String(index+1).padStart(3,'0')}`,part,category,stem,
    options:choices.map((_,i)=>choices[(i-shift+4)%4]),answer:shift,explanation,page:Number(page),sample:sample?Number(sample):null,checked:CHECKED};
});}
export const QUESTIONS=[...parse(A_ROWS,'A'),...parse(B_ROWS,'B')];
