import ImageAuth from '@/assets/images/image-auth.webp'
import { AnvilIcon } from 'lucide-react'

import { Outlet } from 'react-router'

export default function AuthLayout() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2 md:p-4">
      <div className="flex flex-col gap-4 ">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <AnvilIcon className="size-4" />
            </div>
            Lonestone
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <Outlet />
          </div>
        </div>
      </div>
      <div className="relative hidden bg-primary/5 backdrop-blur-sm lg:flex rounded-xl items-center justify-center">
        <img
          src={ImageAuth}
          alt="Image"
          className="object-cover"
          width={500}
          height={400}
        />
      </div>
    </div>
  )
}
