(function () {
  'use strict';
  var root=document.documentElement,overlay=document.getElementById('logo-intro');
  if(!overlay)return;
  var motion=matchMedia('(prefers-reduced-motion: reduce)');
  var art=overlay.querySelector('.logo-intro-art');
  var target=document.querySelector('.brand-logo'),skip=overlay.querySelector('button');
  var closed=false,animations=[],inertStates=[],watchdog;
  function finish(){
    if(closed)return;closed=true;clearTimeout(watchdog);
    var focused=overlay.contains(document.activeElement);
    animations.forEach(function(a){a.cancel();});
    root.classList.remove('logo-intro-pending','logo-intro-playing','logo-intro-revealing');
    inertStates.forEach(function(item){item.el.inert=item.was;});
    document.removeEventListener('keydown',onKey);motion.removeEventListener('change',onMotion);
    overlay.remove();
    if(focused&&target)target.closest('a').focus({preventScroll:true});
  }
  function onKey(e){if(e.key==='Escape')finish();}
  function onMotion(e){if(e.matches)finish();}
  function pause(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});}
  if(motion.matches||!target||!art.animate){finish();return;}
  watchdog=setTimeout(finish,4500);
  skip.addEventListener('click',finish);document.addEventListener('keydown',onKey);motion.addEventListener('change',onMotion);
  (async function(){
    try{
      await Promise.all(Array.from(overlay.querySelectorAll('img')).map(function(img){return img.decode();}));
      if(closed)return;
      overlay.hidden=false;
      root.classList.remove('logo-intro-pending');root.classList.add('logo-intro-playing');
      document.querySelectorAll('header.nav,main,footer').forEach(function(el){inertStates.push({el:el,was:el.inert});el.inert=true;});
      overlay.classList.add('is-building');
      await pause(1120);if(closed)return;
      // One shared diagonal front clips both the logo and backdrop, so the
      // page is revealed precisely where the lines pass. Bubbles trail it.
      root.classList.add('logo-intro-revealing');
      var width=window.innerWidth,height=window.innerHeight,skew=height*.364;
      var start=-150,end=width+skew+180;
      var sweep=document.createElement('div');
      sweep.className='logo-intro-sweep';sweep.setAttribute('aria-hidden','true');
      overlay.appendChild(sweep);
      for(var j=0;j<3;j++){
        var line=document.createElement('span');line.className='logo-intro-line';
        line.style.left=(j-1)*22+'px';sweep.appendChild(line);
      }
      for(var i=0;i<48;i++){
        var bubble=document.createElement('span');
        var size=12+(i*37%75),lane=(i*61%101)/100;
        bubble.className='logo-intro-bubble';
        bubble.style.width=size+'px';bubble.style.height=size+'px';
        bubble.style.left=(-skew*lane-25-i*19%150)+'px';
        bubble.style.top=(lane*height)+'px';
        sweep.appendChild(bubble);
        animations.push(bubble.animate([
          {transform:'translate3d(0,35px,0) scale(.65)',opacity:0},
          {offset:.18,opacity:.85},
          {offset:.65,opacity:.65},
          {transform:'translate3d(-65px,-110px,0) scale(1.1)',opacity:0}
        ],{duration:620,delay:i*13%70,easing:'ease-out',fill:'both'}));
      }
      var timing={duration:650,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'};
      var travel=sweep.animate([
        {transform:'translateX('+start+'px)'},
        {transform:'translateX('+end+'px)'}
      ],timing);
      function edge(x){return 'polygon('+x+'px 0,100% 0,100% 100%,'+(x-skew)+'px 100%)';}
      var wipe=overlay.querySelector('.logo-intro-cover').animate([
        {clipPath:edge(start)},{clipPath:edge(end)}
      ],timing);
      var skipFade=skip.animate([{opacity:1},{opacity:0}],{duration:120,fill:'forwards'});
      animations.push(travel,wipe,skipFade);
      await Promise.all(animations.map(function(animation){return animation.finished;}));
    }catch(e){/* A failed asset or cancelled animation must never block entry. */}
    finally{finish();}
  })();
})();
