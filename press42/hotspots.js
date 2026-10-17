/* FASTER B FX42 verified original-model part hotspots.
   Points use the model's glTF coordinate system, not screen pixels.
   Photos are genuine user-supplied references (not synthetic component shots).
   The interior vacuum/pump locations show genuine casing photos, explicitly labelled. */
(() => {
  const viewer=document.getElementById('viewer'), area=document.getElementById('area');
  if(!viewer || !area)return;
  const parts=[
    {id:'upper',name:'الرأس العلوي للكوي',xyz:[-.27,1.54,.19],tile:4,description:'الجزء العلوي المتحرك الذي يطبق ضغط الكوي على الملابس فوق سطح الكوي السفلي.',photo:'صورة حقيقية للرأس العلوي بالمكبس.'},
    {id:'table',name:'سطح الكوي السفلي',xyz:[-.31,.94,.50],tile:5,description:'السطح الذي توضع عليه قطعة الملابس أثناء عملية الكوي والضغط.',photo:'صورة مرجعية حقيقية لسطح العمل والمنطقة الأمامية.'},
    {id:'arm',name:'ذراع الحركة والزنبركات',xyz:[-.45,1.56,-.08],tile:12,description:'أذرع الربط والزنبركات تساعد على توجيه حركة رأس المكبس وفتحه وإغلاقه.',photo:'صورة تفصيلية حقيقية لآلية الذراع والزنبركات.'},
    {id:'control',name:'لوحة وأزرار التحكم',xyz:[.50,.67,.39],tile:2,description:'تضم عناصر التحكم والتشغيل والمؤشرات الظاهرة على جسم المعدة.',photo:'صورة حقيقية لأزرار التحكم.'},
    {id:'pedals',name:'دواسات التشغيل',xyz:[-.17,.14,.62],tile:3,description:'الدواسات الأمامية تتيح للمشغّل التحكم بالوظائف المرتبطة بدورات تشغيل المكبس، بحسب توصيلات المعدة.',photo:'صورة حقيقية للدواسات الأمامية.'},
    {id:'body',name:'جسم المكبس',xyz:[-.07,.53,.47],tile:11,description:'الهيكل الخارجي يثبت مجموعة الكوي ويضم بعض المكونات والتوصيلات الداخلية.',photo:'صورة حقيقية لجسم المكبس.'},
    {id:'blower',name:'الشفاط — وحدة الشفط',xyz:[-.59,.73,.35],tile:0,description:'وحدة الشفط تسحب الرطوبة والبخار من منطقة العمل للمساعدة على تثبيت الملابس أثناء التشطيب.',photo:'صورة حقيقية للمنطقة الخارجية القريبة من وحدة الشفط؛ المحرك الداخلي غير ظاهر بشكل منفصل.'},
    {id:'pump',name:'مضخة تغذية المياه',xyz:[.58,.19,-.46],tile:1,description:'تدفع المياه إلى الدائرة المخصصة لها ضمن مجموعة التشغيل بالمكبس.',photo:'صورة حقيقية لجسم المعدة؛ لا تتوفر صورة منفصلة موثّقة للمضخة الداخلية.'},
    {id:'hose',name:'توصيلات وخراطيم البخار',xyz:[.48,1.24,.25],tile:9,description:'تنقل البخار والموائع بين مجموعة التشغيل والأجزاء التي تحتاج إلى التغذية.',photo:'صورة حقيقية لخرطوم معدني مرن من التوصيلات.'},
    {id:'safety',name:'صمام الأمان',xyz:[.36,.96,-.32],tile:8,description:'يساعد صمام الأمان على حماية دائرة الضغط عند تجاوز الحدود المحددة للصمام.',photo:'صورة حقيقية لأحد مكونات الصمامات الواردة ضمن صور المعدة المرجعية؛ المطابقة الدقيقة للموديل تحتاج تأكيدًا.'},
    {id:'pressureGauge',name:'مقياس الضغط',xyz:[.20,1.52,-.19],tile:6,description:'يعرض قيمة الضغط في الدائرة التي يرتبط بها للمساعدة على المراقبة أثناء التشغيل.',photo:'صورة مرجعية حقيقية من المنطقة العلوية؛ المقياس نفسه غير واضح منفصلًا في هذه الصورة.'},
    {id:'pressureControl',name:'منظم الضغط',xyz:[.39,1.53,-.22],tile:7,description:'جزء مرتبط بمراقبة الضغط أو تنظيمه في دائرة التشغيل، حسب تجهيز المعدة.',photo:'صورة حقيقية لمنطقة أجهزة التحكم؛ لا تظهر القطعة الداخلية بصورة منفصلة.'},
    {id:'waterLevel',name:'مؤشر مستوى المياه',xyz:[.69,.49,-.12],tile:10,description:'يوضح مستوى المياه ضمن الدائرة أو الخزان الذي يتصل به عند التشغيل.',photo:'صورة حقيقية لمؤشر مستوى المياه الجانبي.'}
  ];
  const pic=document.getElementById('pressPartPhoto');
  const title=document.getElementById('pressPartTitle');
  const description=document.getElementById('pressPartDescription');
  const caption=document.getElementById('pressPartPhotoCaption');
  const backdrop=document.getElementById('pressPartBackdrop');
  const close=document.getElementById('pressPartClose');
  const hint=document.getElementById('pressPartsHint');
  if(!pic || !backdrop || !close)return;
  let resumeRotate=false;
  function openPart(part){
    resumeRotate=viewer.hasAttribute('auto-rotate');
    viewer.removeAttribute('auto-rotate');
    title.textContent=part.name;
    description.textContent=part.description;
    caption.textContent=part.photo;
    const col=part.tile%4,row=Math.floor(part.tile/4);
    pic.style.backgroundPosition=(col*100/3)+'% '+(row*100/3)+'%';
    backdrop.hidden=false;
    hint.hidden=true;
    close.focus({preventScroll:true});
  }
  function closePart(){
    if(backdrop.hidden)return;
    backdrop.hidden=true;
    if(resumeRotate && !document.hidden)viewer.setAttribute('auto-rotate','');
    resumeRotate=false;
  }
  for(const part of parts){
    const b=document.createElement('button');
    b.type='button';
    b.className='press-hotspot';
    b.slot='hotspot-'+part.id;
    b.setAttribute('data-position',part.xyz.map(x=>x.toFixed(3)+'m').join(' '));
    const sideFacing=['pump','safety','waterLevel','pressureControl','hose'].includes(part.id);
    const upward=['table','arm'].includes(part.id);
    b.setAttribute('data-normal',sideFacing?'1 0 0':upward?'0 1 0':'0 0 1');
    b.setAttribute('data-visibility-attribute','visible');
    b.setAttribute('aria-label','عرض معلومات '+part.name);
    b.setAttribute('title',part.name);
    b.textContent='+';
    b.addEventListener('pointerdown',ev=>ev.stopPropagation());
    b.addEventListener('click',ev=>{ev.stopPropagation();openPart(part);});
    viewer.appendChild(b);
  }
  close.addEventListener('click',closePart);
  backdrop.addEventListener('click',ev=>{if(ev.target===backdrop)closePart();});
  document.addEventListener('keydown',ev=>{if(ev.key==='Escape')closePart();});
  viewer.addEventListener('load',()=>{
    // Hide hint shortly after loading: the 3D markers remain visible.
    hint.hidden=false;
    setTimeout(()=>{hint.hidden=true},6500);
  });
  window.addEventListener('pagehide',()=>{backdrop.hidden=true;});
})();
