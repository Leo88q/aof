import { useEffect, useRef, useState } from 'react';
export function useInView() {
  const ref = useRef<HTMLDivElement>(null);
  const [inView,setInView] = useState(false);
  useEffect(() => {
    const node=ref.current;
    if(!node) return;
    const observer=new IntersectionObserver(([entry])=>{
      if(entry.isIntersecting) {setInView(true);observer.disconnect();}
    },{threshold:0.12});
    observer.observe(node);
    return ()=>observer.disconnect();
  },[]);
  return {ref,inView};
}
