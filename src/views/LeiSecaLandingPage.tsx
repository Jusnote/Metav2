"use client";

import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Scale, BookOpen, ScrollText, Landmark, Shield, FileText, ChevronRight, Search, SlidersHorizontal, ChevronDown } from "lucide-react";
import { motion } from "motion/react";

interface LawOption {
  id: string;
  title: string;
  number: string;
  icon: typeof Scale;
  articles: number;
  materia: string;
  available: boolean;
}

const laws: LawOption[] = [
  { id: "cc", title: "Código Civil", number: "Lei nº 10.406/2002", icon: Scale, articles: 2046, materia: "Direito Civil", available: true },
  { id: "cf", title: "Constituição Federal", number: "1988", icon: Landmark, articles: 250, materia: "Direito Constitucional", available: false },
  { id: "cpc", title: "Código de Processo Civil", number: "Lei nº 13.105/2015", icon: ScrollText, articles: 1072, materia: "Processual Civil", available: false },
  { id: "cp", title: "Código Penal", number: "Decreto-Lei nº 2.848/1940", icon: Shield, articles: 361, materia: "Direito Penal", available: false },
  { id: "cdc", title: "Código de Defesa do Consumidor", number: "Lei nº 8.078/1990", icon: FileText, articles: 119, materia: "Direito Civil", available: false },
  { id: "clt", title: "Consolidação das Leis do Trabalho", number: "Decreto-Lei nº 5.452/1943", icon: BookOpen, articles: 922, materia: "Direito do Trabalho", available: false },
];

const materias = ["Todas as matérias", ...Array.from(new Set(laws.map(l => l.materia)))];

export default function LeiSecaLandingPage() {
  const [search, setSearch] = useState("");
  const [materia, setMateria] = useState("Todas as matérias");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [materiaSearch, setMateriaSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = laws.filter((l) => {
    const matchesSearch =
      l.title.toLowerCase().includes(search.toLowerCase()) ||
      l.number.toLowerCase().includes(search.toLowerCase());
    const matchesMateria = materia === "Todas as matérias" || l.materia === materia;
    return matchesSearch && matchesMateria;
  });

  const filteredMaterias = materias.filter(m =>
    m.toLowerCase().includes(materiaSearch.toLowerCase())
  );

  return (
    <div className="min-h-full flex flex-col">
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

        {/* Filter row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="w-full max-w-3xl flex items-center gap-3 mb-6 relative z-10"
        >
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className={`flex items-center gap-2 px-3.5 py-[7px] rounded-[10px] bg-white border text-xs font-medium transition-all ${
                dropdownOpen
                  ? "border-primary shadow-[0_0_0_3px_rgba(37,99,235,0.08)]"
                  : "border-border hover:border-border/80"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>{materia}</span>
              <ChevronDown className={`h-3 w-3 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute top-[calc(100%+6px)] left-0 w-60 bg-white border border-border rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] p-1.5 z-50 max-h-80 flex flex-col">
                <div className="flex items-center gap-2 px-2.5 py-1.5 mb-1 border-b border-border/50">
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Filtrar matéria..."
                    value={materiaSearch}
                    onChange={(e) => setMateriaSearch(e.target.value)}
                    className="flex-1 text-xs bg-transparent outline-none placeholder:text-muted-foreground/60"
                  />
                </div>
                <div className="overflow-y-auto flex-1">
                  {filteredMaterias.map((m) => (
                    <button
                      key={m}
                      onClick={() => { setMateria(m); setDropdownOpen(false); setMateriaSearch(""); }}
                      className={`w-full text-left px-2.5 py-[7px] rounded-lg text-xs transition-all ${
                        materia === m
                          ? "bg-primary/8 text-primary font-semibold"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <span className="text-[11px] text-muted-foreground font-medium ml-auto">
            {filtered.length} {filtered.length === 1 ? "lei" : "leis"}
          </span>
        </motion.div>

        {/* Cards */}
        <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((law, i) => (
            <motion.div
              key={law.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * (i + 1), duration: 0.4 }}
            >
              {law.available ? (
                <Link
                  to={`/lei-seca/${law.id}`}
                  className="group block glass rounded-2xl p-5 glass-hover relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/70 opacity-0 group-hover:opacity-[0.06] transition-opacity" />
                  <div className="relative">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center mb-4 shadow-sm">
                      <law.icon className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="font-display font-bold text-sm mb-0.5">{law.title}</h3>
                    <p className="text-[11px] text-muted-foreground mb-3">{law.number}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">{law.articles} artigos</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="glass rounded-2xl p-5 opacity-50 relative overflow-hidden cursor-not-allowed">
                  <div className="relative">
                    <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center mb-4">
                      <law.icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <h3 className="font-display font-bold text-sm mb-0.5">{law.title}</h3>
                    <p className="text-[11px] text-muted-foreground mb-3">{law.number}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">{law.articles} artigos</span>
                      <span className="text-[9px] font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">Em breve</span>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      <div className="text-center py-6 text-[11px] text-muted-foreground/40">
        Feito para concurseiros que levam a sério.
      </div>
    </div>
  );
}
