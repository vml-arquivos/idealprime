import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
interface Props{children:React.ReactNode;adminOnly?:boolean}
export function ProtectedRoute({children,adminOnly=false}:Props){const {user,loading}=useAuth();const [location,setLocation]=useLocation();useEffect(()=>{if(loading)return;if(!user){setLocation(`/login?redirect=${encodeURIComponent(location)}`,{replace:true});return}if((user as any).accountType==='BUYER'){setLocation('/portal',{replace:true});return}if(adminOnly&&user.role!=='admin')setLocation('/dashboard',{replace:true});},[loading,user,adminOnly,location,setLocation]);if(loading)return <DashboardLayoutSkeleton/>;if(!user||(user as any).accountType==='BUYER'||(adminOnly&&user.role!=='admin'))return null;return <>{children}</>}
