import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Button from "../components/ui/Button";
import {
  ArrowRightIcon,
  ChartBarIcon,
  CubeIcon,
  SparklesIcon,
  ShieldCheckIcon,
  BoltIcon,
  GlobeAltIcon,
  CommandLineIcon,
  PlayIcon,
  CheckBadgeIcon,
  ChevronDownIcon,
  StarIcon,
} from "@heroicons/react/24/outline";

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);

  // Header scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-rotate features
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const scrollToCTA = () => {
    document.getElementById("cta-section")?.scrollIntoView({ behavior: "smooth" });
  };

  const features = [
    {
      icon: <CubeIcon className="h-7 w-7" />,
      title: "Éditeur nodal intuitif",
      description:
        "Glissez-déposez vos sources et transformations sur un canevas infini. Visualisez votre pipeline comme un schéma clair et logique.",
      color: "from-indigo-500 to-blue-600",
      borderLight: "border-indigo-100",
    },
    {
      icon: <CommandLineIcon className="h-7 w-7" />,
      title: "Assistant IA intégré",
      description:
        "Décrivez votre besoin en langage naturel. L'IA génère automatiquement le code SQL ou pandas correspondant à votre transformation.",
      color: "from-purple-500 to-violet-600",
      borderLight: "border-purple-100",
    },
    {
      icon: <BoltIcon className="h-7 w-7" />,
      title: "Exécution en temps réel",
      description:
        "Prévisualisez instantanément le résultat de chaque nœud. Exportez en CSV, JSON ou matérialisez dans votre base de données.",
      color: "from-amber-500 to-orange-600",
      borderLight: "border-amber-100",
    },
  ];

  const stats = [
    { value: "10K+", label: "Transformations exécutées" },
    { value: "500+", label: "Analystes équipés" },
    { value: "99.9%", label: "Disponibilité" },
  ];

  const steps = [
    {
      step: "01",
      title: "Connectez vos sources",
      description:
        "Importez vos fichiers CSV, JSON ou connectez vos bases de données SQL. Support natif des formats francophones (séparateur point-virgule).",
      icon: <GlobeAltIcon className="h-6 w-6" />,
    },
    {
      step: "02",
      title: "Construisez votre pipeline",
      description:
        "Glissez-déposez les transformations sur le canevas : filtres, agrégations, jointures. Visualisez le flux de données en direct.",
      icon: <CubeIcon className="h-6 w-6" />,
    },
    {
      step: "03",
      title: "Lancez l'exécution",
      description:
        "Un clic suffit. Le moteur pandas exécute votre pipeline dans l'ordre topologique et affiche les résultats instantanément.",
      icon: <BoltIcon className="h-6 w-6" />,
    },
    {
      step: "04",
      title: "Exportez & partagez",
      description:
        "Téléchargez en CSV ou JSON. Matérialisez dans votre base. Ou laissez l'IA générer le script pour vos collègues.",
      icon: <ArrowRightIcon className="h-6 w-6" />,
    },
  ];

  const testimonials = [
    {
      quote:
        "AAPROVIDIR a réduit de 80% le temps de traitement de nos rapports COBAC. L'interface visuelle est un game-changer.",
      author: "Marie K.",
      role: "Responsable Conformité",
      company: "Banque Atlantique Cameroun",
      avatar: "MK",
      color: "from-indigo-400 to-blue-500",
    },
    {
      quote:
        "L'assistant IA génère des transformations complexes en quelques secondes. Même nos stagiaires peuvent créer des pipelines.",
      author: "Jean-Paul M.",
      role: "Data Manager",
      company: "MTN Mobile Money",
      avatar: "JM",
      color: "from-purple-400 to-violet-500",
    },
    {
      quote:
        "La gestion native des formats CSV francophones (séparateur ;) nous a épargné des heures de débogage. Merci !",
      author: "Fatima D.",
      role: "Analyste BI",
      company: "Afriland First Bank",
      avatar: "FD",
      color: "from-amber-400 to-orange-500",
    },
  ];

  const trustBadges = [
    { icon: <ShieldCheckIcon className="h-5 w-5" />, text: "Données sécurisées" },
    { icon: <CheckBadgeIcon className="h-5 w-5" />, text: "Conforme COBAC" },
    { icon: <GlobeAltIcon className="h-5 w-5" />, text: "Hébergé en Afrique" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans overflow-x-hidden">
      {/* ========================================== */}
      {/* HEADER FIXED WITH SCROLL EFFECT */}
      {/* ========================================== */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? "bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-lg shadow-slate-200/50 py-3"
            : "bg-transparent py-5"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 text-xl font-black text-white shadow-lg shadow-indigo-500/30 transition-transform group-hover:scale-110 group-hover:rotate-3">
              ⇄
            </div>
            <div>
              {/*<img
                src="/logo.png"
                alt="Logo"
                className="h-full w-full object-cover"
              />*/}
              <span className="text-xl font-bold text-slate-900">AAPRO</span>
              <span className="text-xl font-bold text-indigo-600">VIDIR</span>
              <p className="text-[10px] text-slate-400 leading-tight -mt-0.5">ETL Pipeline Builder</p>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-indigo-600 transition-colors">
              Fonctionnalités
            </a>
            <a href="#how-it-works" className="hover:text-indigo-600 transition-colors">
              Comment ça marche
            </a>
            <a href="#testimonials" className="hover:text-indigo-600 transition-colors">
              Témoignages
            </a>
          </nav>

          {/* CTA Buttons */}
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Se connecter
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="sm" className="shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30">
                Essai gratuit
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ========================================== */}
      {/* HERO SECTION */}
      {/* ========================================== */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        {/* Background gradient orbs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-to-br from-indigo-400/20 via-blue-400/10 to-transparent rounded-full blur-3xl -z-10 animate-pulse" />
        <div className="absolute top-20 right-0 w-[400px] h-[400px] bg-gradient-to-bl from-purple-400/20 to-transparent rounded-full blur-3xl -z-10" />

        <div className="max-w-6xl mx-auto text-center">
          {/* Badge avec animation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/80 backdrop-blur-sm px-5 py-2 text-sm font-semibold text-indigo-700 shadow-sm"
          >
            <SparklesIcon className="h-4 w-4 animate-bounce" />
            <span>Nouveau : Assistant IA génératif</span>
            <span className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 bg-indigo-600 text-white text-xs rounded-full">
              <StarIcon className="h-3 w-3" />
              Beta
            </span>
          </motion.div>

          {/* Titre avec animation stagger */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold leading-tight tracking-tight text-slate-900"
          >
            Vos pipelines de données
            <br />
            <span className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 bg-clip-text text-transparent animate-gradient">
              sans écrire de code
            </span>
          </motion.h1>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-6 max-w-2xl mx-auto text-lg text-slate-500 leading-relaxed"
          >
            L'ETL visuel conçu pour les analystes financiers africains. Connectez, transformez,
            visualisez. Augmenté par l'IA.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link to="/signup">
              <Button className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 text-base font-semibold rounded-xl shadow-xl shadow-indigo-500/30 transition-all hover:shadow-2xl hover:shadow-indigo-500/40 hover:-translate-y-0.5">
                Démarrer gratuitement
                <ArrowRightIcon className="h-5 w-5" />
              </Button>
            </Link>
            <button
              onClick={scrollToCTA}
              className="inline-flex items-center gap-2 bg-white border-2 border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-600 px-8 py-4 text-base font-semibold rounded-xl transition-all hover:-translate-y-0.5"
            >
              <PlayIcon className="h-5 w-5" />
              Voir la démo
            </button>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl mx-auto"
          >
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-3xl font-extrabold text-slate-900">{stat.value}</p>
                <p className="text-sm text-slate-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <ChevronDownIcon className="h-6 w-6 text-slate-400 animate-bounce" />
        </motion.div>
      </section>

      {/* ========================================== */}
      {/* FEATURES SECTION - Interactive Cards */}
      {/* ========================================== */}
      <section id="features" className="py-20 px-6 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto">
          {/* Section header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-sm font-semibold text-indigo-700 mb-4">
              <BoltIcon className="h-4 w-4" />
              Fonctionnalités clés
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
              Tout ce dont vous avez besoin
            </h2>
            <p className="mt-4 text-lg text-slate-500 max-w-2xl mx-auto">
              Une suite complète pour construire, exécuter et maintenir vos pipelines de données
              bancaires.
            </p>
          </motion.div>

          {/* Feature cards with hover effects */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.15 }}
                whileHover={{ y: -8, scale: 1.02 }}
                className={`group relative p-8 bg-white rounded-2xl border ${feature.borderLight} shadow-sm hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden`}
                onMouseEnter={() => setActiveFeature(index)}
              >
                {/* Gradient background on hover */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}
                />

                {/* Icon */}
                <div
                  className={`relative mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${feature.color} text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}
                >
                  {feature.icon}
                </div>

                {/* Content */}
                <h3 className="relative text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                <p className="relative text-slate-500 leading-relaxed">{feature.description}</p>

                {/* Learn more link */}
                <div className="relative mt-6 flex items-center gap-2 text-sm font-semibold text-indigo-600 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                  En savoir plus
                  <ArrowRightIcon className="h-4 w-4" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================== */}
      {/* HOW IT WORKS - Timeline Style */}
      {/* ========================================== */}
      <section id="how-it-works" className="py-20 px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-semibold text-blue-700 mb-4">
              <PlayIcon className="h-4 w-4" />
              Comment ça marche
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
              En 4 étapes simples
            </h2>
          </motion.div>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-indigo-400 via-blue-400 to-cyan-400 hidden md:block" />

            {steps.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                className={`relative flex items-start gap-6 mb-12 md:mb-16 ${
                  index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                }`}
              >
                {/* Timeline dot */}
                <div className="absolute left-8 md:left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-lg z-10">
                  {item.step}
                </div>

                {/* Content card */}
                <div
                  className={`ml-20 md:ml-0 md:w-1/2 ${
                    index % 2 === 0 ? "md:pr-16 md:text-right" : "md:pl-16"
                  }`}
                >
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-shadow">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white mb-4">
                      {item.icon}
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">{item.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================== */}
      {/* TESTIMONIALS SECTION */}
      {/* ========================================== */}
      <section id="testimonials" className="py-20 px-6 bg-white border-t border-slate-100">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-sm font-semibold text-amber-700 mb-4">
              <StarIcon className="h-4 w-4" />
              Témoignages
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
              Ils nous font confiance
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.15 }}
                whileHover={{ y: -6 }}
                className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm hover:shadow-xl transition-all duration-300"
              >
                {/* Stars */}
                <div className="flex gap-1 mb-6">
                  {[...Array(5)].map((_, i) => (
                    <StarIcon key={i} className="h-5 w-5 text-amber-400 fill-amber-400" />
                  ))}
                </div>

                {/* Quote */}
                <p className="text-slate-600 leading-relaxed mb-8 italic">"{testimonial.quote}"</p>

                {/* Author */}
                <div className="flex items-center gap-4 border-t border-slate-100 pt-6">
                  <div
                    className={`h-12 w-12 rounded-full bg-gradient-to-br ${testimonial.color} flex items-center justify-center text-white font-bold text-sm shadow-lg`}
                  >
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{testimonial.author}</p>
                    <p className="text-sm text-slate-500">{testimonial.role}</p>
                    <p className="text-xs text-slate-400">{testimonial.company}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================== */}
      {/* CTA SECTION - Final Call to Action */}
      {/* ========================================== */}
      <section id="cta-section" className="relative py-24 px-6 overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-blue-700 to-purple-800" />

        {/* Animated orbs */}
        <div className="absolute top-10 left-10 w-72 h-72 bg-indigo-400/30 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-10 right-10 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />

        <div className="relative max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            {/* Badge */}
            <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 backdrop-blur-sm px-5 py-2 text-sm font-semibold text-white mb-6">
              <SparklesIcon className="h-4 w-4" />
              Prêt à transformer vos données ?
            </span>

            {/* Title */}
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-6">
              Commencez gratuitement
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-200">
                en moins de 2 minutes
              </span>
            </h2>

            {/* Description */}
            <p className="text-lg text-indigo-100 max-w-2xl mx-auto mb-10 leading-relaxed">
              Pas de carte bancaire requise. Pas de limite de temps. Accédez immédiatement à
              l'éditeur nodal et à l'assistant IA.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/signup">
                <Button className="inline-flex items-center gap-2 bg-white text-indigo-700 hover:bg-amber-50 hover:text-indigo-800 px-10 py-5 text-lg font-bold rounded-2xl shadow-2xl shadow-black/30 transition-all hover:scale-105">
                  Créer mon compte gratuit
                  <ArrowRightIcon className="h-6 w-6" />
                </Button>
              </Link>
              <Link to="/login">
                <Button
                  variant="secondary"
                  className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border-2 border-white/30 text-white hover:bg-white/20 hover:border-white/50 px-10 py-5 text-lg font-semibold rounded-2xl transition-all"
                >
                  Se connecter
                </Button>
              </Link>
            </div>

            {/* Trust badges */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-8">
              {trustBadges.map((badge, i) => (
                <div key={i} className="flex items-center gap-2 text-white/80 text-sm">
                  {badge.icon}
                  <span>{badge.text}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ========================================== */}
      {/* FOOTER */}
      {/* ========================================== */}
      <footer className="bg-slate-900 text-white py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-blue-500 text-xl font-black text-white">
                  ⇄
                </div>
                <span className="text-lg font-bold">AAPROVIDIR</span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                ETL visuel pour le secteur financier africain. Construisez vos pipelines sans code.
              </p>
            </div>

            {/* Links */}
            <div>
              <h4 className="font-semibold mb-4">Produit</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Fonctionnalités
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Tarifs
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Documentation
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    API
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Ressources</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Tutoriels
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Communauté
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Support
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Légal</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Confidentialité
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Conditions
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Conformité
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500">© 2026 AAPROVIDIR. Tous droits réservés.</p>
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <span>🇨🇲 Cameroun</span>
              <span>•</span>
              <span>XAF (FCFA)</span>
              <span>•</span>
              <span>FR / EN</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}