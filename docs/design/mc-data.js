(function(){
const posts=[
{id:'p1',type:'Reel',caption:'Bolo de caneca em 3 min',tone:'#EAD3C3',ink:'#2B2724',date:'28 set',likes:'4,1 mil'},
{id:'p2',type:'Carrossel',caption:'5 marmitas da semana',tone:'#CDBBA7',ink:'#2B2724',date:'26 set',likes:'2,8 mil'},
{id:'p3',type:'Reel',caption:'Pão de queijo de frigideira',tone:'#F4C3AE',ink:'#2B2724',date:'24 set',likes:'9,3 mil'},
{id:'p4',type:'Imagem',caption:'Minha bancada nova',tone:'#DCD3C6',ink:'#2B2724',date:'22 set',likes:'1,2 mil'},
{id:'p5',type:'Reel',caption:'Presets das minhas fotos',tone:'#E6D5C3',ink:'#2B2724',date:'20 set',likes:'3,4 mil'},
{id:'p6',type:'Carrossel',caption:'Lista de compras barata',tone:'#F3E3D3',ink:'#2B2724',date:'18 set',likes:'2,2 mil'},
{id:'p7',type:'Reel',caption:'Lanche saudável pra levar',tone:'#C9D8CB',ink:'#2B2724',date:'15 set',likes:'5,6 mil'},
{id:'p8',type:'Imagem',caption:'Bastidores da gravação',tone:'#F6CDBE',ink:'#2B2724',date:'13 set',likes:'980'},
{id:'p9',type:'Reel',caption:'Brigadeiro de colher fit',tone:'#E2DAD0',ink:'#2B2724',date:'10 set',likes:'7,0 mil'},
{id:'p10',type:'Carrossel',caption:'Utensílios que eu uso',tone:'#D9C6B0',ink:'#2B2724',date:'8 set',likes:'1,9 mil'},
{id:'p11',type:'Reel',caption:'Panqueca de banana',tone:'#EFD2BF',ink:'#2B2724',date:'5 set',likes:'6,2 mil'},
{id:'p12',type:'Imagem',caption:'Obrigada, 48 mil!',tone:'#D5CCE6',ink:'#2B2724',date:'2 set',likes:'3,0 mil'}];
const automations=[
{id:'a1',name:'Guia de receitas grátis',keywords:['RECEITA','GUIA'],match:'exact',target:'specific',postIds:['p1','p3'],status:'active',dms:1284,publicReply:true,replies:['Te mandei na DM! 💌','Corre lá no direct 😉'],dmInitial:'Oi! Que bom que você quer o guia 🍋 Toca no botão aqui embaixo que eu te mando.',btnLabel:'Quero o guia',dmFollower:'Aqui está seu guia de receitas: {link} Bom apetite! 🧁',dmNonFollower:'Quase lá! O guia é exclusivo pra quem me segue. Me segue e toca no botão de novo 💛',requireFollow:true,url:'https://anaribeiro.com.br/guia',linkButton:true,linkLabel:'Baixar guia'},
{id:'a3',name:'Link do curso de marmitas',keywords:['CURSO','QUERO'],match:'exact',target:'all',postIds:[],status:'active',dms:2107,publicReply:true,replies:['Mandei tudo na DM 📩'],dmInitial:'Oi! Aqui é a Ana 👋 Quer saber tudo sobre o curso de marmitas?',btnLabel:'Quero saber',dmFollower:'Todas as informações do curso estão aqui: {link}',dmNonFollower:'Me segue pra liberar o link, tá?',requireFollow:false,url:'https://anaribeiro.com.br/curso',linkButton:true,linkLabel:'Ver o curso'},
{id:'a2',name:'Cupom Black Friday',keywords:['CUPOM'],match:'contains',target:'future',postIds:[],status:'paused',dms:342,publicReply:false,replies:['Cupom enviado na DM!'],dmInitial:'Seu cupom de 20% está a um toque de distância 🎁',btnLabel:'Pegar cupom',dmFollower:'Use o cupom ANA20 aqui: {link}',dmNonFollower:'O cupom é só pra seguidores 😉',requireFollow:true,url:'https://loja.anaribeiro.com.br',linkButton:false,linkLabel:'Abrir loja'},
{id:'a4',name:'Lista de presets',keywords:['PRESET'],match:'exact',target:'specific',postIds:['p5'],status:'draft',dms:0,publicReply:true,replies:['Te mando na DM!'],dmInitial:'Oi! Quer meus presets de foto? 📸',btnLabel:'Quero',dmFollower:'Baixe aqui: {link}',dmNonFollower:'Me segue e toca no botão de novo 💛',requireFollow:true,url:'',linkButton:true,linkLabel:'Baixar presets'}];
const bio={theme:'papel',shape:'arredondado',bio:'Receitas rápidas pra quem não tem tempo 🍋 Comenta a palavra no vídeo que eu te mando na DM.',photo:null,showFollowers:true,showPosts:true,postLayout:'grid3',order:['a1','a3','m1','m2'],hidden:[],manual:[{id:'m1',label:'Meu e-book de receitas',url:'https://anaribeiro.com.br/ebook'},{id:'m2',label:'Loja de utensílios',url:'https://loja.anaribeiro.com.br'}]};
const profile={user:'ana.cozinha',name:'Ana Ribeiro',followers:'48,2 mil',initials:'AR',tone:'#EAD3C3'};
function items(b,autos){
  const all=[...autos.filter(a=>a.status==='active').map(a=>({id:a.id,kind:'auto',label:a.name,keyword:a.keywords[0]||'',postId:a.target==='specific'?a.postIds[0]:null})),...(b.manual||[]).map(l=>({id:l.id,kind:'manual',label:l.label,url:l.url}))];
  const ix=id=>{const i=(b.order||[]).indexOf(id);return i<0?999:i};
  return all.sort((x,y)=>ix(x.id)-ix(y.id)).map(it=>({...it,hidden:(b.hidden||[]).includes(it.id)}));
}
window.MC={posts,automations,bio,profile,items};
})();
