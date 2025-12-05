import { Header } from '@boilerstone/ui/components/layout/Header'
import { Navigation } from '@boilerstone/ui/components/layout/Navigation'
import { Link, Outlet } from 'react-router'

export default function MainLayout() {
  return (
    <>
      <Header>
        <Navigation
          brand={(
            <Link to="/" className="font-bold hover:underline">
              Lonestone
            </Link>
          )}
          sections={[
            {
              items: [
                { to: '/posts', label: 'Posts' },
              ],
            },
          ]}
        />
      </Header>
      <main>
        <Outlet />
      </main>
    </>
  )
}
