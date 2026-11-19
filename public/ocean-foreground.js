/* Restrained 2D foreground over the original 3D ocean. No pointer interception. */
(function () {
  'use strict';
  var canvas=document.getElementById('ocean-foreground');
  if(!canvas)return;
  var c=canvas.getContext('2d');if(!c)return;
  var preference=matchMedia('(prefers-reduced-motion: reduce)'),reduce=preference.matches;
  var introEl=document.querySelector('#faq .faq-intro'),faqEl=document.querySelector('#faq .faq'),jellySlots=[];
  var w=0,h=0,jellyTop=0,jellyGap=0,currentAnchors=[],scroll=window.scrollY,dpr=1,time=0,last=0,frame=0;
  var TAU=Math.PI*2;
  // Water colour used for depth haze: distant animals lose contrast toward it.
  var WATER=[12,54,138];
  // Reef species, one per school (back, flank, belly, fin; optional tail colour and markings).
  var SCHOOLS=[
    {name:'anthias',back:[255,112,20],flank:[255,140,50],belly:[255,180,106],fin:[255,128,52],pattern:'anthias'},
    {name:'tang',back:[234,190,8],flank:[246,210,26],belly:[250,224,76],fin:[244,204,22],pattern:'tang'},
    {name:'clown',back:[240,92,10],flank:[255,106,16],belly:[255,140,62],fin:[255,114,26],pattern:'clown'},
    {name:'butterfly',back:[238,184,16],flank:[245,197,24],belly:[250,222,100],fin:[246,200,30],pattern:'butterfly'},
    {name:'chromis',back:[40,120,228],flank:[66,162,234],belly:[143,214,232],fin:[106,192,236]},
    {name:'angel',back:[20,48,140],flank:[27,63,168],belly:[42,86,186],fin:[30,64,160],tail:[250,206,40],pattern:'angel'}
  ];
  var INK=[18,16,14],WHITE=[255,255,250];
  var gradCache={};
  function hash(n){var s=Math.sin(n*127.1+311.7)*43758.5453;return s-Math.floor(s);}
  function mix(a,b,t){return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];}
  function rgba(col,a){return 'rgba('+(col[0]|0)+','+(col[1]|0)+','+(col[2]|0)+','+a+')';}
  function ellipse(x,y,rx,ry,fill){c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fillStyle=fill;c.fill();}
  function cubic(p,a,b,d,u){var v=1-u;return v*v*v*p+3*v*v*u*a+3*v*u*u*b+u*u*u*d;}
  function jelly(x,y,r,index){
    var bob=Math.sin(time*.8+index*1.7)*(12+index*2);
    y+=bob;
    // Alternate Pacific sea nettles and mauve stingers.
    var nettle=index%2===0;
    // Pulse: quick contraction, slow relaxation.
    var ph=time*1.9+index,p=Math.pow(.5+.5*Math.sin(ph),3);
    var R=r*(1-.1*p),H=r*.62*(1+.18*p),lip=r*.1,j,u,mx,my,tl,sw;
    c.save();c.translate(x,y);c.lineCap='round';c.lineJoin='round';
    // Faint glow of light scattered by the tinted body.
    var halo=c.createRadialGradient(0,-H*.3,r*.2,0,-H*.3,r*1.9);
    halo.addColorStop(0,nettle?'rgba(255,168,104,.1)':'rgba(255,150,190,.1)');halo.addColorStop(1,nettle?'rgba(255,168,104,0)':'rgba(255,150,190,0)');
    ellipse(0,-H*.3,r*1.9,r*1.9,halo);
    // Marginal tentacles.
    c.beginPath();
    if(nettle){
      // Many long, thin salmon tentacles trailing from the whole margin.
      for(j=0;j<24;j++){
        u=j/23;mx=-R*.96+1.92*R*u;my=lip*(1-(2*u-1)*(2*u-1));
        tl=r*(1.4+hash(j+index*40)*1.3)*(1-.15*p);sw=Math.sin(time*1.1+j*.45+index)*r*.22+mx*.15*p;
        c.moveTo(mx,my);c.bezierCurveTo(mx+sw*.3,my+tl*.35,mx-sw*.5,my+tl*.7,mx+sw,my+tl);
      }
      c.strokeStyle='rgba(240,154,122,.55)';c.lineWidth=.6;
    }else{
      // A few very long pale tentacles that sweep out to the sides.
      for(j=0;j<8;j++){
        u=j/7;mx=-R*.92+1.84*R*u;my=lip*(1-(2*u-1)*(2*u-1));
        var side=mx<0?-1:1,out=side*r*(.5+hash(j+index*17)*.9);
        tl=r*(2.1+hash(j*5+index)*.8)*(1-.15*p);sw=Math.sin(time*.9+j*.7+index)*r*.25;
        c.moveTo(mx,my);c.bezierCurveTo(mx+side*r*.15,my+tl*.25,mx+out+sw*.5,my+tl*.55,mx+out*.6+sw,my+tl);
      }
      c.strokeStyle='rgba(255,224,234,.45)';c.lineWidth=.55;
    }
    c.stroke();
    // Oral arms: four frilly ribbons trailing from the centre.
    var armCol=nettle?'rgba(251,238,232,.3)':'rgba(217,74,114,.62)',edgeCol=nettle?'rgba(255,250,246,.55)':'rgba(255,214,226,.6)';
    for(var a=0;a<4;a++){
      var ox=(a-1.5)*R*.12,len=r*(nettle?1.9+hash(a+index*5)*.7:1.15+hash(a+index*5)*.5),wid=r*(nettle?.17:.14);
      c.beginPath();c.moveTo(ox,lip*.5);
      for(var k=1;k<=12;k++){var t=k/12;c.lineTo(ox+(a-1.5)*t*r*.12+Math.sin(time*.9+t*3.2+a*1.3+index)*t*r*.22,lip*.5+t*len);}
      c.strokeStyle=armCol;c.lineWidth=wid;c.stroke();
      // Frilled edges either side of the ribbon.
      c.beginPath();
      for(var e=-1;e<=1;e+=2){
        c.moveTo(ox+e*wid*.45,lip*.5);
        for(k=1;k<=30;k++){var tt=k/30,fr=Math.sin(k*1.9+time*1.4+a+e)*r*.04*(1-tt*.4);c.lineTo(ox+e*wid*.45*(1-tt*.5)+(a-1.5)*tt*r*.12+Math.sin(time*.9+tt*3.2+a*1.3+index)*tt*r*.22+fr,lip*.5+tt*len);}
      }
      c.strokeStyle=edgeCol;c.lineWidth=.6;c.stroke();
    }
    // Translucent tinted bell, deepest at the apex and paler toward the rim.
    var bell=c.createLinearGradient(0,-H,0,lip);
    if(nettle){bell.addColorStop(0,'rgba(240,138,60,.85)');bell.addColorStop(.55,'rgba(244,172,106,.66)');bell.addColorStop(1,'rgba(252,236,206,.5)');}
    else{bell.addColorStop(0,'rgba(242,160,184,.8)');bell.addColorStop(.55,'rgba(246,182,202,.66)');bell.addColorStop(1,'rgba(252,216,228,.52)');}
    c.beginPath();c.moveTo(-R,0);c.bezierCurveTo(-R*.98,-H*1.33,R*.98,-H*1.33,R,0);c.quadraticCurveTo(0,lip*2,-R,0);c.fillStyle=bell;c.fill();
    c.save();c.clip();
    if(nettle){
      // Sixteen dark radial stripes; only the near half is seen.
      for(var s=0;s<16;s++){
        var th=(s+.5)/16*TAU+Math.sin(time*.2+index)*.06,front=Math.cos(th);
        if(front<=0)continue;
        var sx=R*Math.sin(th);
        c.beginPath();c.moveTo(sx*.06,-H*.98);c.quadraticCurveTo(sx*.8,-H*.86,sx,lip);
        c.strokeStyle='rgba(110,26,16,'+(.22+.45*front).toFixed(3)+')';c.lineWidth=Math.max(.8,r*.05)*(.5+.5*front);c.stroke();
      }
    }else{
      // Warts: small darker dots scattered over the bell.
      c.beginPath();
      for(var d=0;d<34;d++){
        var du=hash(d*7+index)*2-1,dv=hash(d*13+index*3),dx=du*R*.95,dy=-(.06+dv*.88)*H*Math.sqrt(1-du*du),ds=r*(.022+hash(d*3+index)*.03);
        c.moveTo(dx+ds,dy);c.arc(dx,dy,ds,0,TAU);
      }
      c.fillStyle='rgba(196,52,96,.6)';c.fill();
    }
    c.restore();
    // Brighter rim, subumbrellar margin and a soft top highlight.
    c.beginPath();c.moveTo(-R,0);c.bezierCurveTo(-R*.98,-H*1.33,R*.98,-H*1.33,R,0);c.strokeStyle=nettle?'rgba(255,214,170,.55)':'rgba(255,214,228,.55)';c.lineWidth=1;c.stroke();
    c.beginPath();c.moveTo(-R,0);c.quadraticCurveTo(0,lip*2,R,0);c.strokeStyle=nettle?'rgba(255,238,214,.45)':'rgba(255,226,236,.45)';c.lineWidth=.9;c.stroke();
    c.beginPath();c.moveTo(-R*.55,-H*.75);c.quadraticCurveTo(-R*.2,-H*1.02,R*.2,-H*.98);c.strokeStyle='rgba(255,255,255,.22)';c.lineWidth=1.4;c.stroke();
    c.restore();
  }
  function currents(){
    var count=w<700?26:44;
    for(var i=0;i<5;i++){
      // Slow currents belong to fixed page locations, unlike passing rushes.
      var y=currentAnchors[i]-scroll;
      if(y < -260 || y > h+260)continue;
      var sway=Math.sin(time*.22+i)*40,sign=i%2?-1:1;
      var x0=-w*.15,x1=w*.23,x2=w*.68,x3=w*1.15;
      var y0=y+sign*85,y1=y-sign*190+sway,y2=y+sign*185-sway,y3=y-sign*70;
      // A barely-there band of lit water rather than a drawn line.
      var g=c.createLinearGradient(0,y,w,y);
      g.addColorStop(0,'rgba(159,230,255,0)');g.addColorStop(.35,'rgba(159,230,255,.05)');g.addColorStop(.65,'rgba(159,230,255,.045)');g.addColorStop(1,'rgba(159,230,255,0)');
      c.beginPath();c.moveTo(x0,y0);c.bezierCurveTo(x1,y1,x2,y2,x3,y3);c.strokeStyle=g;c.lineWidth=56+Math.sin(time*.35+i)*10;c.lineCap='round';c.stroke();
      // Marine snow carried along the current.
      for(var j=0;j<count;j++){
        var seed=j+i*97,u=(hash(seed)+time*.006*(.6+hash(seed*3)*.8))%1;
        var x=cubic(x0,x1,x2,x3,u),yy=cubic(y0,y1,y2,y3,u);
        yy+=(hash(seed*7)-.5)*110+Math.sin(time*.4+j)*5;x+=Math.sin(time*.3+j*1.7)*4;
        var size=.45+hash(seed*11)*hash(seed*11)*1.5,fade=Math.sin(Math.PI*u);
        c.fillStyle='rgba(214,242,255,'+(fade*(.18+hash(seed*5)*.3)).toFixed(3)+')';
        c.beginPath();c.arc(x,yy,size,0,TAU);c.fill();
      }
    }
  }
  function fishGradient(pal,depth){
    var key=pal.name+(depth*10|0);
    if(gradCache[key])return gradCache[key];
    var haze=depth*.3,g=c.createLinearGradient(0,-5.2,0,4.6);
    g.addColorStop(0,rgba(mix(pal.back,WATER,haze),1));
    g.addColorStop(.35,rgba(mix(mix(pal.back,pal.flank,.45),WATER,haze),1));
    g.addColorStop(.58,rgba(mix(pal.flank,WATER,haze),1));
    g.addColorStop(1,rgba(mix(pal.belly,WATER,haze),1));
    return gradCache[key]=g;
  }
  // Profile half-heights along the body, nose (x=16) to caudal peduncle (x=-12.5).
  var BX=[16,14.6,11,6,0,-5,-9.5,-12.5],BT=[0,-2.3,-4.2,-5.2,-5.1,-3.9,-2,-1],BB=[.2,2,3.7,4.6,4.4,3.3,1.7,.9];
  // Species markings, drawn while clipped to the body outline so they flex with it.
  function markings(pal,haze,flex){
    function col(rgb,a){return rgba(mix(rgb,WATER,haze),a);}
    function bar(x0,x1,fill){c.beginPath();c.moveTo(x0,-8+flex(x0));c.lineTo(x1,-8+flex(x1));c.lineTo(x1,8+flex(x1));c.lineTo(x0,8+flex(x0));c.closePath();c.fillStyle=fill;c.fill();}
    var k=pal.pattern;
    if(k==='butterfly'){bar(13.7,10.8,col(INK,.95));bar(10.4,8.5,col(WHITE,.9));}
    else if(k==='clown'){
      var B=[[10.8,7.8],[1.8,-1.8],[-9.6,-11.4]];
      for(var i=0;i<3;i++){bar(B[i][0]+.5,B[i][1]-.5,col(INK,.9));bar(B[i][0],B[i][1],col(WHITE,.97));}
    }else if(k==='angel'){
      c.beginPath();
      for(var s=0;s<7;s++){var yy=-4.3+s*1.35;c.moveTo(11.5,yy*.8+flex(11.5));c.quadraticCurveTo(0,yy-.2+flex(0),-13,yy*.4+flex(-13));}
      c.strokeStyle=col([250,214,48],.85);c.lineWidth=.32;c.stroke();
    }else if(k==='anthias'){
      c.beginPath();c.moveTo(13.8,.3);c.quadraticCurveTo(11.5,1.6,8.6,2.3);c.strokeStyle=col([178,116,232],.8);c.lineWidth=.45;c.stroke();
    }else if(k==='tang'){
      ellipse(-10.7,-.1+flex(-10.7),1.1,.3,col(WHITE,.9));
    }
  }
  function fish(x,y,size,angle,pal,index,depth){
    c.save();c.translate(x,y);c.rotate(angle);
    // Keep the dorsal side up whichever way the fish is heading.
    c.scale(size,Math.cos(angle)<0?-size:size);
    var ph=time*12+index*1.9,haze=depth*.3;
    function flex(px){var s=(16-px)/28;return Math.sin(ph-px*.22)*.55*s*s;}
    var fin=mix(pal.fin,WATER,haze),back=mix(pal.back,WATER,haze);
    // Forked caudal fin; seen in profile its span shrinks as it sweeps edge-on.
    var L=7.4*(.7+.3*Math.abs(Math.cos(ph))),tx=-12.5,td=flex(-16);
    c.beginPath();c.moveTo(tx+.5,BT[7]+flex(tx));
    c.quadraticCurveTo(tx-L*.5,-2.6+td,tx-L,-6.2+td*1.6);
    c.quadraticCurveTo(tx-L*.62,-1.4+td,tx-L*.5,td);
    c.quadraticCurveTo(tx-L*.62,1.4+td,tx-L,5.8+td*1.6);
    c.quadraticCurveTo(tx-L*.5,2.4+td,tx+.5,BB[7]+flex(tx));
    c.closePath();c.fillStyle=pal.tail?rgba(mix(pal.tail,WATER,haze),.9):rgba(mix(fin,back,.35),.8);c.fill();
    // Dorsal and anal fins.
    c.beginPath();c.moveTo(2.6,-5.1+flex(2.6));c.quadraticCurveTo(.6,-6.4,-1.4,-7.3+flex(-1.4));c.quadraticCurveTo(-1.6,-5.6,-4.4,-4.4+flex(-4.4));c.closePath();c.fillStyle=rgba(back,.85);c.fill();
    c.beginPath();c.moveTo(-5.5,3.3+flex(-5.5));c.lineTo(-8.4,5.4+flex(-8));c.lineTo(-9.6,2.1+flex(-9.6));c.closePath();c.fillStyle=rgba(fin,.6);c.fill();
    // Body outline, smoothed through the profile points.
    c.beginPath();c.moveTo(BX[0],BT[0]+flex(BX[0]));
    var n=BX.length,i,mx,my;
    for(i=1;i<n-1;i++){mx=(BX[i]+BX[i+1])/2;my=(BT[i]+BT[i+1])/2+flex(mx);c.quadraticCurveTo(BX[i],BT[i]+flex(BX[i]),mx,my);}
    c.lineTo(BX[n-1],BT[n-1]+flex(BX[n-1]));c.lineTo(BX[n-1],BB[n-1]+flex(BX[n-1]));
    for(i=n-2;i>0;i--){mx=(BX[i]+BX[i-1])/2;my=(BB[i]+BB[i-1])/2+flex(mx);c.quadraticCurveTo(BX[i],BB[i]+flex(BX[i]),mx,my);}
    c.closePath();c.fillStyle=fishGradient(pal,depth);c.fill();
    if(pal.pattern){c.save();c.clip();markings(pal,haze,flex);c.restore();}
    // Gill cover and faint lateral line.
    c.beginPath();c.moveTo(9.6,-3.6);c.quadraticCurveTo(7.9,0,9.4,3.3);c.strokeStyle=rgba(back,.35);c.lineWidth=.45;c.stroke();
    c.beginPath();c.moveTo(8.6,-1.4);c.quadraticCurveTo(-1,-1.6+flex(-1),-11.5,-.3+flex(-11.5));c.strokeStyle=rgba(back,.22);c.lineWidth=.35;c.stroke();
    // Pectoral fin, translucent.
    c.beginPath();c.moveTo(7.6,1.3);c.quadraticCurveTo(4.6,2.6,3.2,3.4+Math.sin(ph*.7)*.5);c.lineTo(5.6,1.5);c.closePath();c.fillStyle=rgba(fin,.45);c.fill();
    // Small dark eye with a silvery iris; no white sclera.
    ellipse(12.1,-1.2,1.2,1.2,rgba(mix([112,124,124],WATER,haze),.8));
    ellipse(12.2,-1.2,.85,.85,rgba(mix([18,24,28],WATER,haze*.7),1));
    ellipse(12.4,-1.45,.2,.2,'rgba(255,255,255,'+(.35-haze*.3).toFixed(2)+')');
    c.restore();
  }
  function rush(){
    if(reduce)return;
    var cycle=Math.floor(time/16),age=time%16;
    var duration=2;
    if(age>duration)return;
    var angles=[-.22,.7,2.72,-1.05,-2.35,.12],a=angles[cycle%angles.length];
    // Rush trajectories use viewport dimensions only, never document scroll.
    var length=Math.hypot(w,h)+900,travel=-length*.5+(age/duration)*length;
    var cx=w*.5+Math.cos(a)*travel,cy=h*.48+Math.sin(a)*travel;
    var count=w<700?10:19;
    // One species per school; each pass sits at its own depth in the water.
    var pal=SCHOOLS[cycle%SCHOOLS.length],depth=[.2,.55,.1,.7,.35,.5][cycle%6];
    for(var i=0;i<count;i++){
      var along=-i*17+Math.sin(time*8+i)*3,across=Math.sin(i*2.37)*24+Math.sin(time*9+i*.7)*5;
      var x=cx+Math.cos(a)*along-Math.sin(a)*across,y=cy+Math.sin(a)*along+Math.cos(a)*across;
      var d=Math.min(1,depth+(hash(i*3+cycle)-.5)*.12);
      c.globalAlpha=.95-d*.4;
      fish(x,y,1.5*(.56-d*.24)*(.92+hash(i+cycle*31)*.16),a+Math.sin(time*2+i)*.03,pal,i,d);
    }c.globalAlpha=1;
  }
  function waterRush(){
    if(reduce)return;
    // Stagger water bursts from fish schools, alternating currents and bubbles.
    var shifted=time+16,cycle=Math.floor(shifted/23),age=shifted%23;
    var duration=1.85;
    if(age>duration)return;
    var angles=[-.12,Math.PI+.09,.17,Math.PI-.14,-.08,Math.PI+.18,.11,Math.PI-.07],angle=angles[cycle%angles.length];
    var extent=Math.hypot(w,h)+900,travel=(age/duration-.5)*extent;
    var x=w*.5+Math.cos(angle)*travel,y=h*.5+Math.sin(angle)*travel;
    var fade=Math.min(1,age/.18,(duration-age)/.2);
    c.save();c.translate(x,y);c.rotate(angle);c.globalAlpha=fade;c.lineCap='round';
    if(cycle%2===0){
      // A surge of water: soft lit band plus particulate smeared by motion.
      var g=c.createLinearGradient(-260,0,200,0);
      g.addColorStop(0,'rgba(159,230,255,0)');g.addColorStop(.5,'rgba(159,230,255,.07)');g.addColorStop(1,'rgba(159,230,255,0)');
      c.fillStyle=g;c.beginPath();c.ellipse(-30,0,230,70,0,0,TAU);c.fill();
      for(var i=0;i<5;i++){
        var yy=(i-2)*24,wiggle=Math.sin(time*9+i)*17;
        for(var k=0;k<14;k++){
          var u=(k/14+time*1.1+i*.13+hash(k+i*14)*.05)%1;
          var px=cubic(-240,-110,40,180,u),py=cubic(yy,yy-40+wiggle,yy+40-wiggle,yy,u)+(hash(k*5+i)-.5)*14;
          var streak=5+hash(k*3+i)*10,sz=.5+hash(k+i*7)*.9;
          c.beginPath();c.moveTo(px-streak,py);c.lineTo(px,py);
          c.strokeStyle='rgba(214,242,255,'+(.12+.25*Math.sin(Math.PI*u)).toFixed(3)+')';c.lineWidth=sz;c.stroke();
        }
      }
    }else{
      for(var j=0;j<(w<700?19:34);j++){
        var hr=hash(j*13+cycle);
        var r=.8+hr*hr*5.5;
        // Smaller bubbles lag and wobble more; larger ones rise straighter.
        var bx=-j*10+Math.sin(j*3.7)*28+Math.sin(time*11+j)*(4-r*.5),by=Math.sin(j*7.1)*70+Math.sin(time*6+j*.8)*(6-r*.6);
        var fill=c.createRadialGradient(bx,by,r*.2,bx,by,r);
        fill.addColorStop(0,'rgba(208,240,255,.02)');fill.addColorStop(.8,'rgba(208,240,255,.06)');fill.addColorStop(1,'rgba(230,250,255,.2)');
        c.beginPath();c.arc(bx,by,r,0,TAU);c.fillStyle=fill;c.fill();
        c.strokeStyle='rgba(236,252,255,.55)';c.lineWidth=Math.min(.8,.3+r*.08);c.stroke();
        ellipse(bx-r*.38,by-r*.4,Math.max(.35,r*.2),Math.max(.25,r*.13),'rgba(255,255,255,.75)');
      }
    }c.restore();
  }
  function draw(){
    c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
    currents();
    // Jellies stay in the side gutters or the FAQ intro column, never over the questions.
    var intro=introEl&&introEl.getBoundingClientRect();
    jellySlots.forEach(function(slot,i){
      if(!slot)return;
      var y=jellyTop+i*jellyGap-scroll,r=1.5*(23+i%3*6);
      if(y < -140 || y > h+140)return;
      var alpha=1;
      if(slot.intro&&intro){
        // Fade out while passing behind the sticky FAQ heading.
        var clear=Math.max(intro.top-(y+r*3.2),(y-r*1.4)-intro.bottom);
        alpha=Math.max(0,Math.min(1,clear/60));
        if(!alpha)return;
      }
      c.globalAlpha=alpha;
      jelly(slot.x+Math.sin(time*.3+i)*7,y,r,i);
      c.globalAlpha=1;
    });
    rush();waterRush();
  }
  function tick(now){frame=0;var dt=last?Math.max(0,Math.min((now-last)/1000,.05)):0;last=now;time+=dt;draw();schedule();}
  function schedule(){if(!frame&&!reduce&&!document.hidden)frame=requestAnimationFrame(tick);}
  function resize(){
    w=innerWidth;h=innerHeight;dpr=Math.min(devicePixelRatio||1,1.5);
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    // Anchor the set pieces before FAQ answers; their positions must not depend
    // on document height, which changes whenever a disclosure opens or closes.
    currentAnchors=['.hero','#about','#tracks','#sponsors','#faq'].map(function(selector){
      return document.querySelector(selector).getBoundingClientRect().top+window.scrollY+Math.min(220,h*.3);
    });
    jellyTop=document.querySelector('#faq').getBoundingClientRect().top+window.scrollY+h*.12;
    jellyGap=Math.max(140,h*.22);
    jellySlots=[];
    if(introEl&&faqEl){
      var ir=introEl.getBoundingClientRect(),fr=faqEl.getBoundingClientRect();
      var left=ir.left>=90?{x:ir.left/2}:null,right=w-fr.right>=90?{x:(w+fr.right)/2}:null;
      var twoCol=fr.left>=ir.right+20;
      var col=function(f){return twoCol?{x:ir.left+ir.width*f,intro:true}:null;};
      jellySlots=[left,right,col(.3),right,col(.75)];
    }
    draw();
  }
  window.addEventListener('resize',resize);
  window.addEventListener('scroll',function(){scroll=window.scrollY;if(reduce)draw();},{passive:true});
  document.addEventListener('visibilitychange',function(){last=0;if(document.hidden&&frame){cancelAnimationFrame(frame);frame=0;}else schedule();});
  preference.addEventListener('change',function(e){reduce=e.matches;last=0;if(reduce&&frame){cancelAnimationFrame(frame);frame=0;}draw();schedule();});
  // Only real viewport/font layout changes refresh these anchors.
  window.addEventListener('load',resize);
  if(document.fonts)document.fonts.ready.then(resize);
  resize();schedule();
})();
