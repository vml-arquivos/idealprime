import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function BusinessSignup(){
 const [,setLocation]=useLocation(); const [form,setForm]=useState({legalName:"",tradeName:"",cnpj:"",email:"",phone:"",name:"",password:""}); const [message,setMessage]=useState("");
 const signup=trpc.b2b.signup.useMutation({onSuccess:()=>setMessage("Cadastro recebido. Sua empresa está aguardando aprovação comercial."),onError:e=>setMessage(e.message)});
 const set=(k:string,v:string)=>setForm(f=>({...f,[k]:v}));
 return <main className="min-h-screen bg-[#FBFDFC] p-4 md:p-10"><div className="mx-auto max-w-2xl rounded-2xl bg-white p-6 md:p-8 shadow-sm border"><BrandLogo compact className="mb-6 w-[170px]" /><h1 className="text-2xl font-semibold text-[#12352B]">Cadastro empresarial</h1><p className="mt-2 text-sm text-[#5E776D]">Crie o acesso da empresa. A compra será liberada após aprovação e atribuição da tabela comercial.</p><form className="grid md:grid-cols-2 gap-4 mt-6" onSubmit={async e=>{e.preventDefault();setMessage("");await signup.mutateAsync(form)}}>
 {[['legalName','Razão social'],['tradeName','Nome fantasia'],['cnpj','CNPJ'],['email','E-mail'],['phone','Telefone'],['name','Responsável'],['password','Senha']].map(([k,l])=><div key={k} className={k==='legalName'||k==='password'?'md:col-span-2':''}><Label>{l}</Label><Input type={k==='password'?'password':'text'} value={(form as any)[k]} onChange={e=>set(k,e.target.value)} required={['legalName','cnpj','email','name','password'].includes(k)} /></div>)}
 <div className="md:col-span-2 flex gap-3 items-center"><Button disabled={signup.isPending} className="bg-[#068A5B] hover:bg-[#0C4536]">{signup.isPending?'Enviando...':'Solicitar acesso'}</Button><Button type="button" variant="outline" onClick={()=>setLocation('/login')}>Já tenho acesso</Button></div>{message&&<p className="md:col-span-2 text-sm text-slate-700 rounded-lg bg-[#F1F8F5] p-3">{message}</p>}</form></div></main>
}
