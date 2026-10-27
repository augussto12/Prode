import { Link } from 'react-router-dom';

export default function HomeSwitch({ active }) {
  return <nav className="home-switch" aria-label="Contenido del inicio"><Link to="/inicio" aria-current={active === 'bets' ? 'page' : undefined} className={active === 'bets' ? 'is-active' : ''}>Apuestas</Link><Link to="/explorar" aria-current={active === 'matches' ? 'page' : undefined} className={active === 'matches' ? 'is-active' : ''}>Partidos</Link></nav>;
}
