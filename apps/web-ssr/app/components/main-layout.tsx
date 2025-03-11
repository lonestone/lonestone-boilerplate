import { Outlet, Link, NavLink } from "react-router";
import { Header } from "@lonestone/ui/components/layout/Header";

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
                <NavLink to="/posts" className={({ isActive }) => isActive ? "text-primary" : ""}>Posts</NavLink>
              </li>
            </ul>
          </nav>
        </div>
      </Header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
