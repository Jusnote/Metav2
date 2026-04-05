"use client";

import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Scale, BookOpen, ScrollText, Landmark, Shield, FileText, ChevronRight, Search, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface LawEntry {
  id: string;
  title: string;
  number: string;
  articles: number;
  available: boolean;
  progress?: number;
}

interface MateriaOption {
  id: string;
  title: string;
  icon: typeof Scale;
  color: string;
  leis: LawEntry[];
}

const materias: MateriaOption[] = [
  {
    id: "penal", title: "Direito Penal", icon: Shield, color: "from-rose-500 to-red-600",
    leis: [
      { id: "cp", title: "Código Penal", number: "Decreto-Lei nº 2.848/1940", articles: 361, available: true, progress: 72 },
      { id: "drogas", title: "Lei de Drogas", number: "Lei nº 11.343/2006", articles: 75, available: true, progress: 41 },
      { id: "maria-penha", title: "Maria da Penha", number: "Lei nº 11.340/2006", articles: 46, available: false },
      { id: "lep", title: "Execução Penal", number: "Lei nº 7.210/1984", articles: 204, available: false },
      { id: "org-crim", title: "Organização Criminosa", number: "Lei nº 12.850/2013", articles: 26, available: false },
      { id: "abuso-aut", title: "Abuso de Autoridade", number: "Lei nº 13.869/2019", articles: 44, available: false },
    ],
  },
  {
    id: "constitucional", title: "Constitucional", icon: Landmark, color: "from-emerald-500 to-teal-600",
    leis: [
      { id: "cf", title: "Constituição Federal", number: "1988", articles: 250, available: false },
    ],
  },
  {
    id: "civil", title: "Direito Civil", icon: Scale, color: "from-primary to-primary/80",
    leis: [
      { id: "cc", title: "Código Civil", number: "Lei nº 10.406/2002", articles: 2046, available: true, progress: 34 },
      { id: "cdc", title: "Código de Defesa do Consumidor", number: "Lei nº 8.078/1990", articles: 119, available: false },
      { id: "eca", title: "Estatuto da Criança e Adolescente", number: "Lei nº 8.069/1990", articles: 267, available: false },
    ],
  },
  {
    id: "processual", title: "Processual Civil", icon: ScrollText, color: "from-violet-500 to-purple-600",
    leis: [
      { id: "cpc", title: "Código de Processo Civil", number: "Lei nº 13.105/2015", articles: 1072, available: false },
    ],
  },
  {
    id: "administrativo", title: "Administrativo", icon: FileText, color: "from-sky-500 to-blue-600",
    leis: [
      { id: "licitacoes", title: "Lei de Licitações", number: "Lei nº 14.133/2021", articles: 194, available: false },
      { id: "improbidade", title: "Improbidade Administrativa", number: "Lei nº 8.429/1992", articles: 25, available: false },
    ],
  },
  {
    id: "trabalho", title: "Direito do Trabalho", icon: BookOpen, color: "from-amber-500 to-orange-600",
    leis: [
      { id: "clt", title: "CLT", number: "Decreto-Lei nº 5.452/1943", articles: 922, available: false },
    ],
  },
];

export default function LeiSecaLandingPage() {
  const [search, setSearch] = useState("");
  const [drawerMateria, setDrawerMateria] = useState<MateriaOption | null>(null);
  const [drawerSearch, setDrawerSearch] = useState("");
  const drawerRef = useRef<HTMLDivElement>(null);

  const totalLeis = (m: MateriaOption) => m.leis.length;
  const totalArticles = (m: MateriaOption) => m.leis.reduce((s, l) => s + l.articles, 0);

  const filtered = materias.filter(
    (m) =>
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.leis.some(l => l.title.toLowerCase().includes(search.toLowerCase()))
  );

  const drawerLeis = drawerMateria?.leis.filter(
    (l) =>
      l.title.toLowerCase().includes(drawerSearch.toLowerCase()) ||
      l.number.toLowerCase().includes(drawerSearch.toLowerCase())
  ) ?? [];

  const closeDrawer = () => { setDrawerMateria(null); setDrawerSearch(""); };

  return (
    <div className="min-h-full flex flex-col relative">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-lg mb-10"
        >
          <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-4">
            Lei Seca<span className="text-gradient">.</span>
          </h1>
          <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
            Escolha a legislação que deseja estudar. Leitura ativa, questões,
            jurisprudência e muito mais.
          </p>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="w-full max-w-md mb-6"
        >
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              placeholder="Buscar legislação..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 pl-10 pr-4 bg-white border border-border rounded-xl text-sm outline-none transition-all focus:border-primary focus:ring-[3px] focus:ring-primary/8"
            />
          </div>
        </motion.div>

        {/* Cards */}
        <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((mat, i) => (
            <motion.div
              key={mat.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * (i + 1), duration: 0.4 }}
            >
              <div
                onClick={() => setDrawerMateria(mat)}
                className={`group block glass rounded-2xl p-5 glass-hover relative overflow-hidden cursor-pointer ${
                  drawerMateria?.id === mat.id ? "ring-2 ring-primary/20 border-primary/30" : ""
                }`}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${mat.color} opacity-0 group-hover:opacity-[0.06] transition-opacity`}
                />
                <div className="relative">
                  <div
                    className={`h-10 w-10 rounded-xl flex items-center justify-center mb-4 ${
                      i === 0
                        ? `bg-gradient-to-br ${mat.color} shadow-sm`
                        : "bg-secondary"
                    }`}
                  >
                    <mat.icon className={`h-5 w-5 ${i === 0 ? "text-white" : "text-muted-foreground"}`} />
                  </div>
                  <h3 className="font-display font-bold text-sm mb-0.5">{mat.title}</h3>
                  <p className="text-[11px] text-muted-foreground mb-3">
                    {totalLeis(mat)} {totalLeis(mat) === 1 ? "lei" : "leis"}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      {totalArticles(mat).toLocaleString()} artigos
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="text-center py-6 text-[11px] text-muted-foreground/40">
        Feito para concurseiros que levam a sério.
      </div>

      {/* Drawer overlay */}
      <AnimatePresence>
        {drawerMateria && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/5 z-10"
            onClick={closeDrawer}
          />
        )}
      </AnimatePresence>

      {/* Drawer */}
      <AnimatePresence>
        {drawerMateria && (
          <motion.div
            ref={drawerRef}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="absolute top-0 right-0 bottom-0 w-[340px] bg-white border-l border-border shadow-[-4px_0_20px_rgba(0,0,0,0.05)] z-20 flex flex-col"
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-border/60 flex items-center gap-3">
              <div className={`h-9 w-9 rounded-[10px] bg-gradient-to-br ${drawerMateria.color} flex items-center justify-center shrink-0`}>
                <drawerMateria.icon className="h-[18px] w-[18px] text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-bold">{drawerMateria.title}</div>
                <div className="text-[11px] text-muted-foreground">{totalLeis(drawerMateria)} leis</div>
              </div>
              <button
                onClick={closeDrawer}
                className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 py-3 border-b border-border/40">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar nesta matéria..."
                  value={drawerSearch}
                  onChange={(e) => setDrawerSearch(e.target.value)}
                  className="w-full h-[34px] pl-8 pr-3 rounded-[9px] bg-muted/50 border border-transparent text-xs outline-none transition-all focus:border-primary/30 focus:bg-white"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2">
              {drawerLeis.map((lei) => (
                lei.available ? (
                  <Link
                    key={lei.id}
                    to={`/lei-seca/${lei.id}`}
                    className="group flex items-center gap-2.5 px-2.5 py-2.5 rounded-[10px] hover:bg-muted/50 transition-all mb-0.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-semibold">{lei.title}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{lei.number}</div>
                      {lei.progress != null && (
                        <div className="mt-1.5">
                          <div className="h-[3px] rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-primary to-primary/80"
                              style={{ width: `${lei.progress}%` }}
                            />
                          </div>
                          <div className="text-[9px] text-muted-foreground mt-0.5">{lei.progress}% lido</div>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{lei.articles} arts.</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </Link>
                ) : (
                  <div key={lei.id} className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-[10px] opacity-45 mb-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-border shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-semibold">{lei.title}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{lei.number}</div>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{lei.articles} arts.</span>
                    <span className="text-[8px] font-medium text-muted-foreground bg-secondary px-1.5 py-0.5 rounded shrink-0">Em breve</span>
                  </div>
                )
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
