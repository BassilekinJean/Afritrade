import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth-service";
import {
  createProject,
  deleteProject,
  listProjects,
  updateProject,
} from "../api/projects";
import type { ProjectSummary } from "../types";
import CreateProjectModal from "../components/CreateProjectModal";
import RenameProjectModal from "../components/RenameProjectModal";
import ConfirmDeleteDialog from "../components/ConfirmDeleteDialog";
import ContextMenu from "../components/ui/ContextMenu";
import Button from "../components/ui/Button";
import Spinner from "../components/ui/Spinner";
import {
  // Navigation
  PlusIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ArrowRightIcon,
  EllipsisVerticalIcon,
  
  // Menu items
  FolderIcon,
  PlayIcon,
  ChartBarIcon,
  SparklesIcon,
  Cog6ToothIcon,
  QuestionMarkCircleIcon,
  BookOpenIcon,
  ChatBubbleLeftRightIcon,
  
  // Status & actions
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  ArrowLeftOnRectangleIcon,
  UserCircleIcon,
  StarIcon,
  BoltIcon,
  CommandLineIcon,
  GlobeAltIcon,
} from "@heroicons/react/24/outline";

// ==========================================
// TYPES
// ==========================================
interface MenuState {
  project: ProjectSummary;
  x: number;
  y: number;
}

type SortOption = "recent" | "name" | "updated";
type ViewMode = "grid" | "list";
type FilterStatus = "all" | "active" | "draft";

interface SidebarNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  children?: Omit<SidebarNavItem, "children">[];
}

// ==========================================
// CONSTANTES
// ==========================================
const SIDEBAR_NAV: SidebarNavItem[] = [
  { id: "projects", label: "Projets", icon: <FolderIcon className="h-5 w-5" />, badge: "0" },
  { id: "executions", label: "Exécutions", icon: <PlayIcon className="h-5 w-5" /> },
  { id: "analytics", label: "Analytiques", icon: <ChartBarIcon className="h-5 w-5" /> },
  { 
    id: "ai", 
    label: "Assistant IA", 
    icon: <SparklesIcon className="h-5 w-5" />,
    children: [
      { id: "ai-sql", label: "Générer SQL", icon: <CommandLineIcon className="h-4 w-4" /> },
      { id: "ai-pandas", label: "Générer Pandas", icon: <BoltIcon className="h-4 w-4" /> },
    ]
  },
];

const SIDEBAR_BOTTOM: SidebarNavItem[] = [
  { id: "docs", label: "Documentation", icon: <BookOpenIcon className="h-5 w-5" /> },
  { id: "help", label: "Support", icon: <QuestionMarkCircleIcon className="h-5 w-5" /> },
  { id: "settings", label: "Paramètres", icon: <Cog6ToothIcon className="h-5 w-5" /> },
];

// ==========================================
// COMPOSANT PRINCIPAL
// ==========================================
export default function Projects() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Data states
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI states
  const [creating, setCreating] = useState(false);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [renaming, setRenaming] = useState<ProjectSummary | null>(null);
  const [deleting, setDeleting] = useState<ProjectSummary | null>(null);
  
  // Navigation states
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeNav, setActiveNav] = useState("projects");
  const [expandedItems, setExpandedItems] = useState<string[]>(["ai"]);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Filter & Sort states
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");

  // ==========================================
  // DATA FETCHING
  // ==========================================
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listProjects();
      setProjects(data);
      // Update badge count
      SIDEBAR_NAV[0].badge = String(data.length);
    } catch (e: any) {
      setError(e.message || "Impossible de charger les projets.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // ==========================================
  // COMPUTED VALUES
  // ==========================================
  const filteredProjects = projects
    .filter((p) => {
      if (filterStatus === "active") return p.status === "active";
      if (filterStatus === "draft") return p.status === "draft";
      return true;
    })
    .filter((p) => p.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "name") return a.title.localeCompare(b.title);
      if (sortBy === "updated") return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const stats = {
    total: projects.length,
    active: projects.filter((p) => p.status === "active").length,
    draft: projects.filter((p) => p.status === "draft").length,
    recentCount: projects.filter((p) => {
      const created = new Date(p.created_at);
      const now = new Date();
      return now.getTime() - created.getTime() < 7 * 24 * 60 * 60 * 1000;
    }).length,
  };

  // ==========================================
  // HANDLERS
  // ==========================================
  const handleCreate = async (title: string) => {
    const project = await createProject(title);
    navigate(`/projets/${project.id}`);
  };

  const handleRename = async (title: string) => {
    if (!renaming) return;
    await updateProject(renaming.id, { title });
    setProjects((ps) =>
      ps.map((p) =>
        p.id === renaming.id ? { ...p, title, updated_at: new Date().toISOString() } : p
      )
    );
  };

  const handleDelete = async () => {
    if (!deleting) return;
    await deleteProject(deleting.id);
    setProjects((ps) => ps.filter((p) => p.id !== deleting.id));
  };

  const toggleNavItem = (id: string) => {
    setExpandedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // ==========================================
  // RENDER
  // ==========================================
  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
      {/* ========================================== */}
      {/* MOBILE OVERLAY */}
      {/* ========================================== */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ========================================== */}
      {/* SIDEBAR */}
      {/* ========================================== */}
      <aside
        className={`
          fixed lg:relative z-50 h-full
          bg-slate-900 text-white flex flex-col
          transition-all duration-300 ease-in-out
          ${sidebarCollapsed ? "w-[72px]" : "w-64"}
          ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          shadow-2xl
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 via-blue-500 to-cyan-500 flex items-center justify-center text-lg font-black text-white shadow-lg shadow-indigo-500/30 flex-shrink-0">
              ⇄
            </div>
            {!sidebarCollapsed && (
              <div className="overflow-hidden whitespace-nowrap">
                <h1 className="text-lg font-bold leading-tight">
                  AAPRO<span className="text-indigo-400">VIDIR</span>
                </h1>
                <p className="text-[10px] text-slate-400 leading-tight">Pipeline Builder</p>
              </div>
            )}
          </div>
          
          {/* Close on mobile */}
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="lg:hidden p-1 rounded-lg hover:bg-slate-800 text-slate-400"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto scrollbar-thin">
          {SIDEBAR_NAV.map((item) => (
            <SidebarNavItem
              key={item.id}
              item={item}
              active={activeNav === item.id}
              collapsed={sidebarCollapsed}
              expanded={expandedItems.includes(item.id)}
              onToggle={() => item.children && toggleNavItem(item.id)}
              onClick={() => {
                setActiveNav(item.id);
                setMobileSidebarOpen(false);
              }}
            />
          ))}
        </nav>

        {/* Bottom Navigation */}
        <div className="px-3 py-2 space-y-1 border-t border-slate-800">
          {SIDEBAR_BOTTOM.map((item) => (
            <SidebarNavItem
              key={item.id}
              item={item}
              active={activeNav === item.id}
              collapsed={sidebarCollapsed}
              onClick={() => {
                setActiveNav(item.id);
                setMobileSidebarOpen(false);
              }}
            />
          ))}
        </div>

        {/* User Section */}
        <div className="p-3 border-t border-slate-800">
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className={`w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 transition-colors ${
                sidebarCollapsed ? "justify-center" : ""
              }`}
            >
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center text-sm font-bold text-white flex-shrink-0 shadow-lg">
                {user?.email?.[0]?.toUpperCase() ?? "?"}
              </div>
              {!sidebarCollapsed && (
                <>
                  <div className="flex-1 text-left overflow-hidden">
                    <p className="text-sm font-medium truncate">{user?.email}</p>
                    <p className="text-xs text-slate-400">Analyste</p>
                  </div>
                  <ChevronDownIcon className={`h-4 w-4 text-slate-400 transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />
                </>
              )}
            </button>

            {/* User Dropdown */}
            {userMenuOpen && (
              <div className={`absolute ${sidebarCollapsed ? "left-full bottom-0 ml-2 w-56" : "bottom-full left-0 right-0 mb-2"} bg-slate-800 rounded-xl border border-slate-700 shadow-2xl overflow-hidden`}>
                <div className="px-4 py-3 border-b border-slate-700">
                  <p className="text-sm font-medium truncate">{user?.email}</p>
                  <p className="text-xs text-slate-400">Compte gratuit</p>
                </div>
                <div className="py-1">
                  <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 transition-colors">
                    <UserCircleIcon className="h-4 w-4" />
                    Profil
                  </button>
                  <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 transition-colors">
                    <Cog6ToothIcon className="h-4 w-4" />
                    Paramètres
                  </button>
                  <button
                    onClick={() => signOut()}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <ArrowLeftOnRectangleIcon className="h-4 w-4" />
                    Se déconnecter
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="hidden lg:flex items-center justify-center p-3 border-t border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          {sidebarCollapsed ? (
            <ChevronRightIcon className="h-5 w-5" />
          ) : (
            <ChevronLeftIcon className="h-5 w-5" />
          )}
        </button>
      </aside>

      {/* ========================================== */}
      {/* MAIN CONTENT */}
      {/* ========================================== */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* ========================================== */}
        {/* TOP BAR */}
        {/* ========================================== */}
        <header className="bg-white border-b border-slate-200 shadow-sm">
          <div className="px-4 sm:px-6 py-3">
            <div className="flex items-center gap-4">
              {/* Mobile menu trigger */}
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {/* Breadcrumb */}
              <div className="hidden sm:flex items-center gap-2 text-sm text-slate-500">
                <span className="text-slate-400">Accueil</span>
                <ChevronRightIcon className="h-4 w-4" />
                <span className="font-medium text-slate-700">Projets</span>
              </div>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Create button (mobile) */}
              <button
                onClick={() => setCreating(true)}
                className="lg:hidden p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/25"
              >
                <PlusIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Bottom row: Search, Filters, Actions */}
            <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              {/* Search */}
              <div className="relative w-full sm:max-w-xs">
                <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white placeholder-slate-400"
                />
              </div>

              {/* Filter tabs */}
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                {([
                  { value: "all", label: "Tous" },
                  { value: "active", label: "Actifs" },
                  { value: "draft", label: "Brouillons" },
                ] as const).map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setFilterStatus(value)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      filterStatus === value
                        ? "bg-white text-indigo-700 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {label}
                    {value === "active" && (
                      <span className="ml-1.5 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px]">
                        {stats.active}
                      </span>
                    )}
                    {value === "draft" && (
                      <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px]">
                        {stats.draft}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex-1" />

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="recent">Plus récents</option>
                <option value="updated">Dernière modification</option>
                <option value="name">Nom</option>
              </select>

              {/* View toggle */}
              <div className="hidden sm:flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded-md transition-all ${
                    viewMode === "grid" ? "bg-white shadow-sm text-indigo-600" : "text-slate-400 hover:text-slate-600"
                  }`}
                  aria-label="Vue grille"
                >
                  <Squares2X2Icon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 rounded-md transition-all ${
                    viewMode === "list" ? "bg-white shadow-sm text-indigo-600" : "text-slate-400 hover:text-slate-600"
                  }`}
                  aria-label="Vue liste"
                >
                  <ListBulletIcon className="h-4 w-4" />
                </button>
              </div>

              {/* Create button (desktop) */}
              <Button
                onClick={() => setCreating(true)}
                className="hidden lg:inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/25 px-4 py-2"
              >
                <PlusIcon className="h-4 w-4" />
                Nouveau projet
              </Button>
            </div>
          </div>
        </header>

        {/* ========================================== */}
        {/* PAGE CONTENT */}
        {/* ========================================== */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          <div className="p-4 sm:p-6 space-y-6">
            {/* ========================================== */}
            {/* STATS CARDS */}
            {/* ========================================== */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={<FolderIcon className="h-5 w-5" />}
                label="Total projets"
                value={stats.total}
                color="indigo"
                trend="+12%"
              />
              <StatCard
                icon={<PlayIcon className="h-5 w-5" />}
                label="Actifs"
                value={stats.active}
                color="emerald"
              />
              <StatCard
                icon={<ClockIcon className="h-5 w-5" />}
                label="Brouillons"
                value={stats.draft}
                color="amber"
              />
              <StatCard
                icon={<StarIcon className="h-5 w-5" />}
                label="Cette semaine"
                value={stats.recentCount}
                color="purple"
              />
            </div>

            {/* ========================================== */}
            {/* WELCOME BANNER (si vide) */}
            {/* ========================================== */}
            {projects.length === 0 && !loading && !error && (
              <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-blue-600 to-purple-700 rounded-2xl p-6 sm:p-8 text-white shadow-xl">
                {/* Background pattern */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl" />
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-400 rounded-full blur-3xl" />
                </div>
                
                <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold mb-2">
                      👋 Bienvenue sur AAPROVIDIR
                    </h2>
                    <p className="text-indigo-100 text-sm sm:text-base max-w-lg">
                      Créez votre premier pipeline ETL en quelques clics. Glissez-déposez vos sources,
                      enchaînez les transformations, et laissez l'IA vous assister.
                    </p>
                    <div className="flex flex-wrap gap-3 mt-5">
                      <Button
                        onClick={() => setCreating(true)}
                        className="bg-white text-indigo-700 hover:bg-amber-50 inline-flex items-center gap-2 font-semibold shadow-lg"
                      >
                        <PlusIcon className="h-4 w-4" />
                        Créer un projet
                      </Button>
                      <Button
                        variant="secondary"
                        className="bg-white/10 text-white border border-white/20 hover:bg-white/20 inline-flex items-center gap-2"
                      >
                        <PlayIcon className="h-4 w-4" />
                        Voir le tutoriel
                      </Button>
                    </div>
                  </div>
                  <div className="hidden lg:flex items-center gap-4">
                    <div className="h-20 w-20 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center text-4xl shadow-lg">
                      ⇄
                    </div>
                    <div className="flex flex-col gap-2">
                      {[
                        { icon: <CheckCircleIcon className="h-4 w-4" />, text: "Import CSV/JSON" },
                        { icon: <BoltIcon className="h-4 w-4" />, text: "Transformations visuelles" },
                        { icon: <SparklesIcon className="h-4 w-4" />, text: "Assistant IA" },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-indigo-100">
                          {item.icon}
                          {item.text}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================== */}
            {/* ERROR */}
            {/* ========================================== */}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-3">
                <ExclamationCircleIcon className="h-5 w-5 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700 flex-1">{error}</p>
                <button
                  onClick={load}
                  className="text-sm font-medium text-red-600 hover:text-red-800 underline"
                >
                  Réessayer
                </button>
              </div>
            )}

            {/* ========================================== */}
            {/* LOADING */}
            {/* ========================================== */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Spinner className="text-indigo-600 h-10 w-10" />
                <p className="text-sm text-slate-400 animate-pulse">Chargement des projets...</p>
              </div>
            ) : filteredProjects.length === 0 && projects.length > 0 ? (
              /* Empty search results */
              <div className="text-center py-20">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl mb-4">
                  🔍
                </div>
                <p className="font-semibold text-slate-600">Aucun résultat</p>
                <p className="text-sm text-slate-400 mt-1">
                  Essayez de modifier votre recherche ou vos filtres.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setFilterStatus("all");
                  }}
                  className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  Réinitialiser les filtres
                </button>
              </div>
            ) : viewMode === "grid" ? (
              /* ========================================== */
              /* GRID VIEW */
              /* ========================================== */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProjects.map((p) => (
                  <ProjectCardEnhanced
                    key={p.id}
                    project={p}
                    onOpen={() => navigate(`/projets/${p.id}`)}
                    onMenu={(x, y) => setMenu({ project: p, x, y })}
                  />
                ))}
              </div>
            ) : (
              /* ========================================== */
              /* LIST VIEW */
              /* ========================================== */
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Table header */}
                <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase">
                  <div className="col-span-5">Nom</div>
                  <div className="col-span-2">Statut</div>
                  <div className="col-span-2">Modifié le</div>
                  <div className="col-span-2">Nœuds</div>
                  <div className="col-span-1 text-right">Actions</div>
                </div>

                {/* Table body */}
                <div className="divide-y divide-slate-100">
                  {filteredProjects.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => navigate(`/projets/${p.id}`)}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-4 px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors items-center"
                    >
                      {/* Name */}
                      <div className="sm:col-span-5 flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-md">
                          ⇄
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">{p.title}</p>
                          <p className="text-xs text-slate-400">ID: {p.id.slice(0, 8)}</p>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="sm:col-span-2 flex items-center gap-2">
                        <StatusBadge status={p.status || "draft"} />
                      </div>

                      {/* Date */}
                      <div className="sm:col-span-2 text-sm text-slate-500">
                        {new Date(p.updated_at).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>

                      {/* Node count */}
                      <div className="sm:col-span-2 text-sm text-slate-500">
                        {p.node_count ?? 0} nœud{(p.node_count ?? 0) > 1 ? "s" : ""}
                      </div>

                      {/* Actions */}
                      <div className="sm:col-span-1 flex justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            setMenu({ project: p, x: rect.left, y: rect.bottom });
                          }}
                          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                          <EllipsisVerticalIcon className="h-5 w-5 text-slate-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ========================================== */}
      {/* MODALS */}
      {/* ========================================== */}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: "Ouvrir", onClick: () => navigate(`/projets/${menu.project.id}`) },
            { label: "Renommer", onClick: () => setRenaming(menu.project) },
            { label: "Dupliquer", onClick: () => {} },
            { label: "Supprimer", danger: true, onClick: () => setDeleting(menu.project) },
          ]}
        />
      )}

      <CreateProjectModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={handleCreate}
      />

      <RenameProjectModal
        open={!!renaming}
        currentTitle={renaming?.title ?? ""}
        onClose={() => setRenaming(null)}
        onRename={handleRename}
      />

      <ConfirmDeleteDialog
        open={!!deleting}
        projectTitle={deleting?.title ?? ""}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

// ==========================================
// SOUS-COMPOSANTS
// ==========================================

function SidebarNavItem({
  item,
  active,
  collapsed,
  expanded,
  onToggle,
  onClick,
}: {
  item: SidebarNavItem;
  active: boolean;
  collapsed: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  onClick: () => void;
}) {
  const hasChildren = !!item.children;

  return (
    <div>
      <button
        onClick={hasChildren ? onToggle : onClick}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm group ${
          active
            ? "bg-indigo-600/10 text-indigo-400 font-semibold border border-indigo-500/20"
            : "text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent"
        } ${collapsed ? "justify-center" : ""}`}
        title={collapsed ? item.label : undefined}
      >
        <span className="flex-shrink-0">{item.icon}</span>
        
        {!collapsed && (
          <>
            <span className="flex-1 text-left truncate">{item.label}</span>
            
            {item.badge && (
              <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${
                active ? "bg-indigo-600 text-white" : "bg-slate-700 text-slate-300"
              }`}>
                {item.badge}
              </span>
            )}
            
            {hasChildren && (
              <ChevronDownIcon
                className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            )}
          </>
        )}
      </button>

      {/* Children */}
      {hasChildren && expanded && !collapsed && (
        <div className="ml-4 mt-1 space-y-1 border-l border-slate-700 pl-4">
          {item.children!.map((child) => (
            <button
              key={child.id}
              onClick={onClick}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              {child.icon}
              {child.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  trend,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "indigo" | "emerald" | "amber" | "purple";
  trend?: string;
}) {
  const colorMap = {
    indigo: { bg: "bg-indigo-50", text: "text-indigo-600", icon: "text-indigo-500" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600", icon: "text-emerald-500" },
    amber: { bg: "bg-amber-50", text: "text-amber-600", icon: "text-amber-500" },
    purple: { bg: "bg-purple-50", text: "text-purple-600", icon: "text-purple-500" },
  };

  const colors = colorMap[color];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:border-slate-300">
      <div className="flex items-start justify-between mb-3">
        <div className={`h-10 w-10 rounded-lg ${colors.bg} flex items-center justify-center ${colors.icon}`}>
          {icon}
        </div>
        {trend && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            {trend}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string; icon: React.ReactNode }> = {
    active: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Actif", icon: <CheckCircleIcon className="h-3 w-3" /> },
    draft: { bg: "bg-amber-50", text: "text-amber-700", label: "Brouillon", icon: <ClockIcon className="h-3 w-3" /> },
    archived: { bg: "bg-slate-100", text: "text-slate-500", label: "Archivé", icon: <FolderIcon className="h-3 w-3" /> },
  };

  const { bg, text, label, icon } = config[status] || config.draft;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
      {icon}
      {label}
    </span>
  );
}

function ProjectCardEnhanced({
  project,
  onOpen,
  onMenu,
}: {
  project: ProjectSummary;
  onOpen: () => void;
  onMenu: (x: number, y: number) => void;
}) {
  return (
    <div
      className="group bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all duration-300 cursor-pointer overflow-hidden"
      onClick={onOpen}
    >
      {/* Gradient top bar */}
      <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500" />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-indigo-500/30 flex-shrink-0">
              ⇄
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900 truncate">{project.title}</h3>
              <p className="text-xs text-slate-400">
                Créé le {new Date(project.created_at).toLocaleDateString("fr-FR")}
              </p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              onMenu(rect.left, rect.bottom);
            }}
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-slate-100 transition-all flex-shrink-0"
          >
            <EllipsisVerticalIcon className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        {/* Info */}
        <div className="flex items-center gap-3 mb-4">
          <StatusBadge status={project.status || "draft"} />
          {(project.node_count ?? 0) > 0 && (
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <BoltIcon className="h-3 w-3" />
              {project.node_count} nœud{(project.node_count ?? 0) > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <span className="text-xs text-slate-400">
            Modifié {new Date(project.updated_at).toLocaleDateString("fr-FR")}
          </span>
          <span className="opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1 text-xs font-medium text-indigo-600">
            Ouvrir
            <ArrowRightIcon className="h-3 w-3" />
          </span>
        </div>
      </div>
    </div>
  );
}