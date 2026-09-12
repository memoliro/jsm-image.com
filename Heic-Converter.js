const dropzone=document.getElementById('dropzone'), fileInput=document.getElementById('fileInput'), fileBtn=document.getElementById('fileBtn'), preview=document.getElementById('preview'), qualityInput=document.getElementById('quality'), qVal=document.getElementById('qVal');
if(qualityInput) qualityInput.addEventListener('input', e=> qVal.textContent=e.target.value+'%');
fileBtn.onclick=()=> fileInput.click();
dropzone.ondragover=e=>{e.preventDefault(); dropzone.style.background='#eee'};
dropzone.ondragleave=()=> dropzone.style.background='';
dropzone.ondrop=e=>{e.preventDefault(); dropzone.style.background=''; handleFiles(e.dataTransfer.files)};
fileInput.onchange=e=> handleFiles(e.target.files);
async function handleFiles(files){
 preview.innerHTML='Converting...';
 let first=true;
 for(const file of files){
  if(first){ preview.innerHTML=''; first=false; }
  try{
   const blob = await heic2any({blob: file, toType:'image/jpeg', quality: (qualityInput?qualityInput.value/100:0.92)});
   const url = URL.createObjectURL(blob);
   const div=document.createElement('div'); div.className='preview-item';
   div.innerHTML=`<img src="${url}"><a href="${url}" download="${file.name.replace(/\.heic$/i,'.jpg')}">Download JPG</a>`;
   preview.appendChild(div);
  }catch(err){ const p=document.createElement('p'); p.textContent=`Error ${file.name}: ${err.message}`; preview.appendChild(p); }
 }
}
