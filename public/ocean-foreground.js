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
  function ellipse(x,y,rx,ry,fill){c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fillStyle=fill;c.fill();}
  function cubic(p,a,b,d,u){var v=1-u;return v*v*v*p+3*v*v*u*a+3*v*u*u*b+u*u*u*d;}
  function jelly(x,y,r,index){
    var hue=(time*9+index*64+195)%360,bob=Math.sin(time*.8+index*1.7)*(12+index*2);
    y+=bob;
    var pulse=1+Math.sin(time*1.9+index)*.065;
    var halo=c.createRadialGradient(x,y,2,x,y,r*3.3);
    halo.addColorStop(0,'hsla('+hue+',85%,76%,.3)');halo.addColorStop(.45,'hsla('+hue+',80%,64%,.1)');halo.addColorStop(1,'transparent');
    ellipse(x,y,r*3.3,r*3.3,halo);
    c.save();c.translate(x,y);c.scale(pulse,2-pulse);
    for(var j=0;j<7;j++){
      c.beginPath();c.moveTo((j-3)*r*.24,4);
      for(var k=1;k<17;k++)c.lineTo((j-3)*r*.24+Math.sin(time*1.6+k*.42+index+j*.2)*k*.65,k*r*.18);
      c.strokeStyle='hsla('+hue+',58%,65%,.65)';c.lineWidth=j%2?1.3:2;c.stroke();
    }
    var bell=c.createLinearGradient(0,-r*1.2,0,8);
    bell.addColorStop(0,'hsla('+hue+',50%,47%,.82)');bell.addColorStop(.7,'hsla('+hue+',65%,70%,.74)');bell.addColorStop(1,'hsla('+hue+',70%,81%,.8)');
    c.beginPath();c.moveTo(-r,0);c.bezierCurveTo(-r,-r*1.65,r,-r*1.65,r,0);c.quadraticCurveTo(0,10,-r,0);c.fillStyle=bell;c.fill();
    c.beginPath();c.ellipse(0,1,r*.95,4,0,0,TAU);c.strokeStyle='hsla('+hue+',90%,89%,.85)';c.lineWidth=1.6;c.stroke();
    c.beginPath();c.moveTo(-r*.65,-r*.3);c.quadraticCurveTo(-r*.35,-r,r*.15,-r*.9);c.strokeStyle='#fff3';c.lineWidth=2;c.stroke();
    c.restore();
  }
  function currents(){
    for(var i=0;i<5;i++){
      // Slow currents belong to fixed page locations, unlike passing rushes.
      var y=currentAnchors[i]-scroll;
      if(y < -260 || y > h+260)continue;
      var sway=Math.sin(time*.22+i)*40,sign=i%2?-1:1;
      var x0=-w*.15,x1=w*.23,x2=w*.68,x3=w*1.15;
      var y0=y+sign*85,y1=y-sign*190+sway,y2=y+sign*185-sway,y3=y-sign*70;
      var color=i%2?'#bdb5da':'#a2d8c4';
      var g=c.createLinearGradient(0,y,w,y);g.addColorStop(0,color+'00');g.addColorStop(.3,color+'24');g.addColorStop(.7,color+'20');g.addColorStop(1,color+'00');
      c.beginPath();c.moveTo(x0,y0);c.bezierCurveTo(x1,y1,x2,y2,x3,y3);c.strokeStyle=g;c.lineWidth=13+Math.sin(time*.35+i)*4;c.stroke();
      c.beginPath();c.moveTo(x0,y0+7);c.bezierCurveTo(x1,y1+11,x2,y2-6,x3,y3+5);c.strokeStyle=color+'36';c.lineWidth=.9;c.stroke();
      for(var j=0;j<17;j++){
        var u=(j/17+time*.018+i*.11)%1;
        var x=cubic(x0,x1,x2,x3,u),yy=cubic(y0,y1,y2,y3,u);
        ellipse(x,yy,1+(j%3)*.25,.75,color+'66');
      }
    }
  }
  function fish(x,y,size,angle,color,index){
    c.save();c.translate(x,y);c.rotate(angle);c.scale(size,size);
    var beat=Math.sin(time*30+index*1.7);
    c.rotate(beat*.045);
    ellipse(0,0,15,6+beat*.35,color);
    c.beginPath();c.moveTo(-11,0);c.lineTo(-26,-7+beat*4);c.lineTo(-26,7+beat*4);c.closePath();c.fillStyle=color;c.fill();
    c.beginPath();c.moveTo(-1,1);c.lineTo(-8,7+Math.sin(time*25+index)*3);c.lineTo(5,3);c.fillStyle=color;c.fill();
    ellipse(9,-1,1.3,1.3,'#e6f7e4');ellipse(9.5,-1,.65,.65,'#264759');
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
    for(var i=0;i<count;i++){
      var along=-i*17+Math.sin(time*8+i)*3,across=Math.sin(i*2.37)*24+Math.sin(time*9+i*.7)*5;
      var x=cx+Math.cos(a)*along-Math.sin(a)*across,y=cy+Math.sin(a)*along+Math.cos(a)*across;
      c.globalAlpha=.48+(i%3)*.12;
      fish(x,y,.37+(i%3)*.09,a,['#72aa9e','#a2b0c9','#ceb894'][i%3],i);
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
    c.save();c.translate(x,y);c.rotate(angle);c.globalAlpha=fade;
    if(cycle%2===0){
      for(var i=0;i<5;i++){
        var yy=(i-2)*24,wiggle=Math.sin(time*9+i)*17;
        var g=c.createLinearGradient(-240,0,180,0);
        g.addColorStop(0,'#a9ded000');g.addColorStop(.45,'#b3ddd22b');g.addColorStop(.8,'#d4e9e226');g.addColorStop(1,'#d4e9e200');
        c.beginPath();c.moveTo(-240,yy);c.bezierCurveTo(-110,yy-40+wiggle,40,yy+40-wiggle,180,yy);c.strokeStyle=g;c.lineWidth=9+i%2*5;c.stroke();
        c.beginPath();c.moveTo(-200,yy+5);c.bezierCurveTo(-90,yy-30+wiggle,50,yy+35-wiggle,160,yy+3);c.strokeStyle='#d5eee14d';c.lineWidth=.9;c.setLineDash([20,28]);c.lineDashOffset=-time*240;c.stroke();c.setLineDash([]);
        for(var k=0;k<9;k++){
          var u=(k/9+time*1.7+i*.13)%1;
          var px=cubic(-240,-110,40,180,u),py=cubic(yy,yy-40+wiggle,yy+40-wiggle,yy,u);
          ellipse(px,py,2.8,.85,'#d4eddd66');
        }
      }
    }else{
      for(var j=0;j<(w<700?19:34);j++){
        var bx=-j*10+Math.sin(j*3.7)*28+Math.sin(time*11+j)*5,by=Math.sin(j*7.1)*70+Math.sin(time*8+j*.8)*10,r=(2+j%6)*(1+Math.sin(time*10+j)*.09);
        c.beginPath();c.arc(bx,by,r,0,TAU);c.strokeStyle='#c0e5e17d';c.lineWidth=1;c.stroke();
        var glint=3.4+Math.sin(time*5+j)*.35;
        c.beginPath();c.arc(bx-r*.16,by-r*.12,r*.65,glint,glint+1.4);c.strokeStyle='#effff08c';c.lineWidth=1;c.stroke();
        c.beginPath();c.moveTo(bx-r-5,by);c.lineTo(bx-r-20,by);c.strokeStyle='#b4ddcf24';c.lineWidth=.8;c.stroke();
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
      var y=jellyTop+i*jellyGap-scroll,r=23+i%3*6;
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
