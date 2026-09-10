import { Outlet } from 'react-router'
import { Toaster } from '@pitchkit/ui/components/primitives/sonner'

import ImageAuth from '@/assets/images/image-auth.webp'
import RostiLogo from '@/assets/images/rosti-logo.svg'

export default function AuthLayout() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2 md:p-4">
      <div className="flex flex-col gap-4 ">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="/" className="flex items-center gap-2 font-medium">
            <img src={RostiLogo} alt="" className="size-7 rounded-md object-contain" />
            <span className="tracking-tight">Rösti</span>
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <Outlet />
          </div>
        </div>
      </div>
      <div className="relative hidden bg-primary/5 backdrop-blur-sm lg:flex rounded-xl items-center justify-center">
        <img src={ImageAuth} alt="" className="object-cover" width={500} height={400} />
      </div>
      <Toaster position="bottom-right" richColors />
    </div>
  )
}
