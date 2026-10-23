import {projectDirections} from './project-directions.ts';

export const learningStages=[
  {id:'c-foundations',title:'C 语言基础',description:'从能解释概念，走向可以独立写出小程序。'},
  {id:'c-structure',title:'程序结构与可靠性',description:'把零散功能组织为可检查、可复用的模块。'},
  {id:'embedded',title:'嵌入式与系统实践',description:'通过状态、时间与外设组织真实系统行为。'},
] as const;
export const knowledgeTopics=[
  {id:'c-control',stage:'c-foundations',title:'条件与循环',goal:'说明分支条件，独立组织有边界的循环。',prerequisites:[],keywords:['条件','循环','switch','while']},
  {id:'c-functions',stage:'c-foundations',title:'函数与数据传递',goal:'拆分职责，说明参数、返回值和变量作用域。',prerequisites:['c-control'],keywords:['函数','作用域']},
  {id:'c-arrays',stage:'c-foundations',title:'数组与字符串',goal:'处理索引和结束条件，说明访问边界。',prerequisites:['c-control'],keywords:['数组','字符串']},
  {id:'c-pointers',stage:'c-foundations',title:'指针与内存',goal:'说明地址、解引用和对象生命周期。',prerequisites:['c-functions','c-arrays'],keywords:['指针','内存','const']},
  {id:'c-types',stage:'c-structure',title:'结构体与枚举',goal:'用类型表达数据和有限状态。',prerequisites:['c-functions'],keywords:['结构体','枚举','enum','typedef']},
  {id:'c-modules',stage:'c-structure',title:'头文件与模块化',goal:'区分声明与定义，为模块设计明确接口。',prerequisites:['c-functions','c-types'],keywords:['头文件','模块','extern','static']},
  {id:'c-testing',stage:'c-structure',title:'边界测试与调试',goal:'为输入边界、异常路径和重复执行保留测试证据。',prerequisites:['c-functions','c-arrays'],keywords:['测试','调试','边界']},
  {id:'embedded-state',stage:'embedded',title:'状态机与滞回',goal:'说明状态转换条件，检查临界值与错误恢复。',prerequisites:['c-types','c-testing'],keywords:['状态机','滞回','状态']},
  {id:'embedded-time',stage:'embedded',title:'非阻塞计时',goal:'组织周期行为，避免等待阻塞其他输入。',prerequisites:['c-control','embedded-state'],keywords:['计时','周期','delay','超时']},
  {id:'embedded-io',stage:'embedded',title:'外设与通信',goal:'通过接口约定、信号与错误反馈理解外设交互。',prerequisites:['c-modules','embedded-time'],keywords:['外设','GPIO','传感器','CAN','I2C','SPI']},
] as const;
export const practiceExercises=[
  {id:'branch-boundary',title:'边界条件与分支',stage:'c-foundations',knowledgeIds:['c-control'],goal:'写一个有明确输入范围的小程序，检查每条分支。',steps:['定义输入范围与预期输出。','独立写出条件与循环，先检查最小用例。','检查边界和无效输入，记录实际结果。'],acceptance:['至少覆盖正常、边界与无效输入。','说明每种情况为什么进入该分支。']},
  {id:'string-reverse',title:'字符串反转',stage:'c-foundations',knowledgeIds:['c-arrays','c-pointers'],goal:'在明确的长度和容量约束下反转字符串。',steps:['明确是否允许修改原字符串。','写出实现并检查索引或指针的访问范围。','测试空字符串、单字符和常见输入。'],acceptance:['结果符合预期且不越过对象边界。','说明结束条件与字符终止符的处理。']},
  {id:'module-counter',title:'把计数器拆成模块',stage:'c-structure',knowledgeIds:['c-functions','c-modules'],goal:'用一个头文件和实现文件组织计数器接口。',steps:['列出初始化、读取和更新接口。','区分声明与定义，隐藏内部状态。','写一个调用程序，测试重置与重复更新。'],acceptance:['调用端通过接口工作。','说明变量作用域与模块边界。']},
  {id:'state-hysteresis',title:'状态机与故障恢复',stage:'embedded',knowledgeIds:['c-types','embedded-state','c-testing'],goal:'用不同的触发与恢复条件组织有限状态机。',steps:['先画出状态与转换条件。','实现输入驱动的转换，不依赖真实硬件。','测试临界值、重复输入和故障恢复。'],acceptance:['每条转换都能用输入序列重现。','说明触发与恢复阈值的区别。']},
  {id:'periodic-sampling',title:'非阻塞周期采样',stage:'embedded',knowledgeIds:['embedded-time','embedded-state'],goal:'让周期采样与按钮处理同时进行。',steps:['用可控制的时间输入设计模拟用例。','组织周期判断，保留每次处理的时间。','检查等待期间的其他输入是否仍可处理。'],acceptance:['时间不足与时间达到时行为正确。','保留输入序列与实际输出，区分模拟和硬件运行。']},
] as const;
const milestoneSets=[
  [{id:'interface',title:'接口与数据模型',knowledgeIds:['c-types','c-modules'],acceptance:'说明数据结构、对外接口和边界条件。'},{id:'implementation',title:'核心实现',knowledgeIds:['embedded-state','c-pointers'],acceptance:'提供实现与可重现的输入输出。'},{id:'verification',title:'验证与复盘',knowledgeIds:['c-testing'],acceptance:'覆盖异常路径，保留测试结果与修正说明。'}],
  [{id:'interface',title:'硬件与接口约定',knowledgeIds:['embedded-io'],acceptance:'说明接口、连接和输入输出约定。'},{id:'implementation',title:'驱动与交互',knowledgeIds:['embedded-io','embedded-time'],acceptance:'提供采样或控制流程，记录真实或模拟环境。'},{id:'verification',title:'调试与验证',knowledgeIds:['c-testing'],acceptance:'保存实际反馈、故障表现及恢复测试。'}],
  [{id:'interface',title:'协议与报文模型',knowledgeIds:['c-types','embedded-io'],acceptance:'说明所用协议和报文边界，不猜测设备行为。'},{id:'implementation',title:'解析与状态处理',knowledgeIds:['c-modules','embedded-state'],acceptance:'为输入序列保留解析结果和状态变化。'},{id:'verification',title:'异常与复盘',knowledgeIds:['c-testing'],acceptance:'检查异常、重复输入与恢复过程。'}],
];
// The three original directions keep their fixed ids; Wayneo is appended explicitly so
// appending it never shifts an id onto a different direction.
const legacyProjectIds=['c-engine','embedded-controller','automotive-bus'];
const wayneoMilestones=[
  {id:'interface',title:'页面与内容结构',knowledgeIds:[] as string[],acceptance:'说明页面结构、内容字段与访客可见范围的约定。'},
  {id:'implementation',title:'内容与项目管理',knowledgeIds:[] as string[],acceptance:'把介绍、公开手记与项目进展接入同一套内容维护流程。'},
  {id:'verification',title:'发布与访问验证',knowledgeIds:[] as string[],acceptance:'检查保存草稿、确认公开、撤下与访客访问的完整路径。'},
];
export const studioProjects=[
  ...projectDirections.map((p,index)=>({...p,id:legacyProjectIds[index],milestones:milestoneSets[index]})),
  {id:'wayneo',num:'NO.04 / PERSONAL WEBSITE',title:'Wayneo',desc:'把个人介绍、公开手记和项目进展放在同一个网站，持续完善内容与使用体验。',tags:['个人网站','持续开发'],milestones:wayneoMilestones},
];
export function publicTopicReferences(records:readonly {date:string;items:readonly {label:string;text:string}[]}[],topicId:string){
  const topic=knowledgeTopics.find(t=>t.id===topicId);
  if(!topic)return [];
  return records.filter(r=>r.items.some(i=>topic.keywords.some(k=>(i.label+' '+i.text).toLowerCase().includes(k.toLowerCase())))).map(r=>r.date).sort().reverse();
}
