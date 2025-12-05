import { Header } from '@boilerstone/ui/components/layout/Header'
import { Link, NavLink, Outlet } from 'react-router'

export default function MainLayout() {
  return (
    <>
      <Header>
        <div className="container mx-auto flex items-center gap-8 px-4">
          <Link to="/" className="font-bold hover:underline">
            Lonestone
          </Link>
          <nav>
            <ul className="flex gap-2 text-sm">
              <li>
                <NavLink to="/posts" className={({ isActive }) => isActive ? 'text-primary' : ''}>Posts</NavLink>
              </li>
            </ul>
          </nav>
        </div>
      </Header>
      <main>
        <Outlet />
      </main>
    </>
  )
}
