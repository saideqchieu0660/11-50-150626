import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { Play, BookOpen, Search, X, ChevronLeft, ChevronRight, Sparkles, Pin, PinOff, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Deck, store } from '../lib/store';
import { useTheme } from '../components/ThemeProvider';

interface DeckListProps {
  decks: Deck[];
  showSearch?: boolean;
  groupBySubject?: boolean;
  onCategoryQuiz?: (subject: string, subjectDecks: Deck[]) => void;
  onCategoryReviewHardCards?: (subject: string, subjectDecks: Deck[]) => void;
  isAdmin?: boolean;
}

const TiltCard = ({ children, delayIdx, className = "" }: { children: React.ReactNode, delayIdx: number, className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });
  
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    x.set(mouseX / width - 0.5);
    y.set(mouseY / height - 0.5);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const { theme, isEcoMode } = useTheme();

  if (isEcoMode) {
    return (
      <div className={`h-full ${className}`}>
        <div className="relative p-6 sm:p-8 rounded-2xl flex flex-col group overflow-visible min-h-[17rem] h-full border border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-900 transition-colors shadow-sm">
          {children}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delayIdx * 0.1, type: "spring", stiffness: 100 }}
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      className={`perspective-1000 h-full ${className}`}
    >
      <div className="card-3d relative p-6 sm:p-8 rounded-2xl flex flex-col group overflow-visible min-h-[17rem] h-full transform-style-3d bg-white/70 dark:bg-black/80">
        {children}
      </div>
    </motion.div>
  );
};

export const DeckList = ({ decks, showSearch = true, groupBySubject = false, onCategoryQuiz, onCategoryReviewHardCards, isAdmin = false }: DeckListProps) => {
  const currentUser = store.getCurrentUser();
  const [pinnedDecks, setPinnedDecks] = useState<string[]>(() => {
    const saved = localStorage.getItem(`pinned_decks_${currentUser?.id || 'guest'}`);
    return saved ? JSON.parse(saved) : [];
  });
  
  const togglePin = (deckId: string) => {
    setPinnedDecks(prev => {
      const newPinned = prev.includes(deckId) 
        ? prev.filter(id => id !== deckId) 
        : [...prev, deckId];
      localStorage.setItem(`pinned_decks_${currentUser?.id || 'guest'}`, JSON.stringify(newPinned));
      return newPinned;
    });
  };

  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isSavingCategoryName, setIsSavingCategoryName] = useState(false);

  const handleRenameCategory = async (oldName: string, newName: string) => {
    const trimmedNewName = newName.trim();
    if (!trimmedNewName || oldName === trimmedNewName) {
      setEditingCategory(null);
      return;
    }
    setIsSavingCategoryName(true);
    try {
      const { db } = await import("../lib/firebase");
      const { collection, getDocs, writeBatch } = await import("firebase/firestore");
      
      const setsRef = collection(db, "sets");
      const querySnapshot = await getDocs(setsRef);
      const batch = writeBatch(db);
      let count = 0;
      
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && data.subject === oldName) {
          batch.update(docSnap.ref, { subject: trimmedNewName });
          count++;
        }
      });
      
      if (count > 0) {
        await batch.commit();
        const updatedLocalDecks = store.getDecks().map(d => d.subject === oldName ? { ...d, subject: trimmedNewName } : d);
        store.setDecksLocally(updatedLocalDecks);
        // Page will refresh or the store trigger will update UI as StudentDashboard reacts to store if hooked, or user can reload.
        window.location.reload(); 
      }
    } catch (err) {
      console.error("Error renaming category:", err);
      alert("Đã có lỗi xảy ra khi đổi tên danh mục.");
    } finally {
      setIsSavingCategoryName(false);
      setEditingCategory(null);
    }
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"default" | "newest" | "oldest" | "az" | "za">("default");
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    const saved = localStorage.getItem('recentSearches');
    return saved ? JSON.parse(saved) : [];
  });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const scrollContainersRef = useRef<Record<string, HTMLDivElement | null>>({});

  const scrollCategory = (subject: string, direction: 'left' | 'right') => {
    const container = scrollContainersRef.current[subject];
    if (container) {
      const scrollAmount = container.clientWidth * 0.75; // Cuộn 75% chiều rộng container để xem bài tiếp theo một cách hợp lý
      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const saveSearch = (query: string) => {
    if (!query.trim()) return;
    const newRecent = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(newRecent);
    localStorage.setItem('recentSearches', JSON.stringify(newRecent));
  };

  const sortedAndFilteredDecks = useMemo(() => {
    let result = [...decks].filter(deck => 
      deck.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (deck.subject || "Tự chọn").toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (sortOrder === "newest") {
      result.sort((a, b) => {
        const timeA = a.createdAt ? (typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : a.createdAt) : 0;
        const timeB = b.createdAt ? (typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : b.createdAt) : 0;
        return timeB - timeA;
      });
    } else if (sortOrder === "oldest") {
      result.sort((a, b) => {
        const timeA = a.createdAt ? (typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : a.createdAt) : 0;
        const timeB = b.createdAt ? (typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : b.createdAt) : 0;
        return timeA - timeB;
      });
    } else if (sortOrder === "az") {
      result.sort((a, b) => a.title.localeCompare(b.title, 'vi'));
    } else if (sortOrder === "za") {
      result.sort((a, b) => b.title.localeCompare(a.title, 'vi'));
    }

    // Always sort pinned items to the top if not grouping by subject
    // (If grouping, they are shown in a pinned section)
    result.sort((a, b) => {
      const aPinned = pinnedDecks.includes(a.id);
      const bPinned = pinnedDecks.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });

    return result;
  }, [decks, searchQuery, sortOrder, pinnedDecks]);

  const groupedDecks = useMemo(() => {
    const groups: Record<string, Deck[]> = {};
    
    sortedAndFilteredDecks.forEach((deck) => {
      if (pinnedDecks.includes(deck.id)) {
        if (!groups["📌 ĐÃ GHIM"]) groups["📌 ĐÃ GHIM"] = [];
        groups["📌 ĐÃ GHIM"].push(deck);
      }
      
      const subj = String(deck?.subject || "Tự chọn").trim();
      const normalizedSubj = subj.toUpperCase();
      if (!groups[normalizedSubj]) groups[normalizedSubj] = [];
      groups[normalizedSubj].push(deck);
    });

    return groups;
  }, [sortedAndFilteredDecks, pinnedDecks]);

  const getCreatorLabel = (d: Deck) => {
    const systemDecks = ["deck_1", "deck_phil_2", "deck_math_1", "deck_math_2", "deck_physics_1", "deck_physics_2", "daily-quest", "remind-later-deck"];
    if (systemDecks.includes(d.id) || !d.createdBy || d.createdBy === "system") {
      return "Hệ thống";
    }
    const currentUser = store.getCurrentUser();
    if (currentUser && d.createdBy === currentUser.id) {
      return "Bởi bạn";
    }
    if (d.creatorRole === "admin" || d.creatorRole === "Admin" || d.creatorRole === "teacher") {
      return `Admin - ${(d as any).creatorName || "CoStudy Admin"}`;
    }
    return (d as any).creatorName ? `Bởi ${(d as any).creatorName}` : "Học viên";
  };

  return (
    <div className="space-y-10">
      {showSearch && (
        <div className="flex flex-col sm:flex-row gap-4 items-center w-full my-8">
          <div className="relative w-full max-w-2xl flex-1">
            <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
              <Search className="h-8 w-8 text-stone-400" />
            </div>
            <input
              type="text"
              placeholder="Tìm kiếm bộ thẻ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsDropdownOpen(true)}
              onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveSearch(searchQuery);
              }}
              className="block w-full pl-16 pr-16 py-5 border-2 border-stone-300 dark:border-stone-700 rounded-2xl bg-white dark:bg-stone-900 focus:ring-4 focus:ring-yellow-500/55 focus:border-yellow-500 transition text-xl sm:text-3xl min-h-[72px] font-black"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-2 flex items-center justify-center w-16 h-16 min-w-[64px] min-h-[64px] hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-full transition-colors my-auto focus:outline-none"
                aria-label="Clear Search"
              >
                <X className="h-7 w-7 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200" />
              </button>
            )}
            {isDropdownOpen && !searchQuery && recentSearches.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-4 bg-white dark:bg-stone-900 border-2 border-stone-300 dark:border-stone-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
                <div className="px-8 py-5 text-base sm:text-xl text-stone-500 uppercase tracking-widest font-black border-b-2 border-stone-200 dark:border-stone-700">Tìm kiếm gần đây</div>
                {recentSearches.map((search) => (
                  <button
                    key={search}
                    onClick={() => setSearchQuery(search)}
                    className="w-full text-left px-8 py-5 text-xl sm:text-2xl hover:bg-stone-100 dark:hover:bg-stone-800 transition font-black min-h-[64px]"
                  >
                    {search}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div className="w-full sm:w-auto shrink-0 flex items-center bg-white dark:bg-stone-900 border-2 border-stone-300 dark:border-stone-700 rounded-2xl px-4 py-2 min-h-[72px]">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="bg-transparent text-lg sm:text-xl font-bold text-stone-700 dark:text-stone-300 focus:outline-none w-full appearance-none cursor-pointer pr-8"
              style={{ backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right center', backgroundSize: '1.2em' }}
            >
              <option value="default">Sắp xếp: Mặc định</option>
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất (sớm nhất)</option>
              <option value="az">A-Z</option>
              <option value="za">Z-A</option>
            </select>
          </div>
        </div>
      )}

      <div className="space-y-12">
        {sortedAndFilteredDecks.length > 0 ? (
          groupBySubject ? (
            <div className="space-y-16">
              {Object.entries(groupedDecks).sort(([subjectA], [subjectB]) => {
                if (subjectA === "📌 ĐÃ GHIM") return -1;
                if (subjectB === "📌 ĐÃ GHIM") return 1;
                return subjectA.localeCompare(subjectB);
              }).map(([subject, subjectDecks]) => (
                <div key={subject} className="space-y-8 animate-in fade-in duration-300">
                  {/* Category Header Bar with Horizontal Control Buttons */}
                  <div className="flex items-center justify-between gap-4 border-b border-amber-500/20 dark:border-zinc-800/60 pb-4">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20 shadow-sm shrink-0">
                        <BookOpen className="w-6 h-6" />
                      </span>
                      <div className="flex items-baseline gap-3">
                        <h4 className="text-2xl sm:text-3xl font-black text-stone-900 dark:text-stone-100 tracking-tight uppercase">
                          {subject}
                        </h4>
                        <span className="text-sm sm:text-base font-black opacity-60 text-amber-600 dark:text-amber-400">
                          ({subjectDecks.length} bộ học)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {onCategoryReviewHardCards && (() => {
                         const remindIds = JSON.parse(localStorage.getItem("remind_later_items") || "[]");
                         const hardCardsInCat = subjectDecks.flatMap(d => d.cards || []).filter(c => remindIds.includes(c.id));
                         if (hardCardsInCat.length > 0) {
                           return (
                             <button
                               onClick={() => onCategoryReviewHardCards(subject, subjectDecks)}
                               className="mr-1 text-xs font-black bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white px-4 py-2.5 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_15px_rgba(239,68,68,0.4)] flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-red-500/50 cursor-pointer shrink-0"
                               title={`Ôn lại ${hardCardsInCat.length} thẻ khó trong mục này`}
                             >
                               <span className="flex items-center justify-center bg-white/20 rounded-full w-5 h-5 text-[10px]">{hardCardsInCat.length}</span>
                               <span className="hidden leading-none sm:inline">Ôn Thẻ X</span>
                             </button>
                           );
                         }
                         return null;
                      })()}
                      {onCategoryQuiz && (
                        <button
                          onClick={() => onCategoryQuiz(subject, subjectDecks)}
                          className="mr-1 text-xs font-black bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black px-4 py-2.5 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-md flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 cursor-pointer shrink-0"
                          title={`Tạo đề thi AI cho mục ${subject}`}
                        >
                          <Sparkles className="w-4 h-4 text-black animate-pulse shrink-0" />
                          <span className="hidden leading-none sm:inline">Tạo Đề Thi AI Mục Này</span>
                          <span className="sm:hidden leading-none">Thi AI</span>
                        </button>
                      )}

                      {/* Scroll buttons for Desktop navigation */}
                      {subjectDecks.length > 1 && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => scrollCategory(subject, 'left')}
                            className="w-10 h-10 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 flex items-center justify-center border border-stone-200 dark:border-zinc-700 text-stone-700 dark:text-stone-300 transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                            title="Cuộn sang trái"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => scrollCategory(subject, 'right')}
                            className="w-10 h-10 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 flex items-center justify-center border border-stone-200 dark:border-zinc-700 text-stone-700 dark:text-stone-300 transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                            title="Cuộn sang phải"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Horizontal Scroll Area for this Category */}
                  <div
                    ref={(el) => { scrollContainersRef.current[subject] = el; }}
                    className="flex overflow-x-auto gap-6 sm:gap-8 pb-6 pt-2 px-1 snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-amber-500/20 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-700/50 [&::-webkit-scrollbar-thumb]:rounded-full cursor-grab active:cursor-grabbing"
                  >
                    {subjectDecks.map((deck, idx) => {
                      const masteredCount = deck.cards.filter(c => c.mastery >= 80).length;
                      const masteryRate = deck.cards.length > 0 ? Math.round((masteredCount / deck.cards.length) * 100) : 0;
                      
                      const estimatedSeconds = deck.cards.reduce((acc, card) => {
                          const m = card.mastery || 0;
                          if (m >= 80) return acc + 10;
                          if (m >= 50) return acc + 25;
                          if (m >= 20) return acc + 40;
                          return acc + 60;
                      }, 0);
                      const estimatedMinutes = Math.ceil(estimatedSeconds / 60);

                      return (
                        <TiltCard key={deck.id} delayIdx={idx} className="w-[85vw] sm:w-[380px] shrink-0 snap-start h-auto">
                          <div className="absolute top-4 right-4 z-20">
                            <button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin(deck.id); }}
                              className={`p-2 rounded-full transition-colors ${pinnedDecks.includes(deck.id) ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30' : 'bg-stone-100 dark:bg-zinc-800 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'}`}
                              title={pinnedDecks.includes(deck.id) ? 'Bỏ ghim' : 'Ghim danh sách này'}
                            >
                              {pinnedDecks.includes(deck.id) ? <Pin className="w-5 h-5 fill-current" /> : <Pin className="w-5 h-5" />}
                            </button>
                          </div>
                          <div className="relative z-10 flex flex-col h-full [transform:translateZ(30px)] pt-2">
                            <h4 className="font-extrabold text-2xl sm:text-3xl mb-3 pr-10 group-hover:text-amber-500 transition-colors line-clamp-2 break-all break-words leading-relaxed">{deck.title}</h4>
                            
                            <div className="flex flex-wrap items-center gap-4 mb-8">
                              <span className="text-base sm:text-l font-mono font-black opacity-85 uppercase tracking-widest leading-relaxed">{deck.subject || "Tự chọn"}</span>
                              <span className="text-sm sm:text-base px-4 py-2.5 rounded-xl font-mono font-black uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 border-2 border-amber-500/20 leading-relaxed">
                                {getCreatorLabel(deck)}
                              </span>
                              <span className="flex items-center gap-1.5 text-sm sm:text-base px-4 py-2.5 rounded-xl font-mono font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-500/20 leading-relaxed">
                                <Clock className="w-4 h-4" />
                                {estimatedMinutes > 0 ? `~${estimatedMinutes}p` : `<1p`}
                              </span>
                            </div>
                            
                            <div className="mt-auto pt-6 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between gap-6">
                              <div className="flex flex-col gap-3 w-full mr-4">
                                <div className="flex justify-between items-center text-base sm:text-xl font-mono font-black leading-relaxed flex-wrap gap-2">
                                  <span className="whitespace-nowrap">Thông thạo</span>
                                  <span className="text-yellow-600 dark:text-yellow-400 whitespace-nowrap">{masteryRate}%</span>
                                </div>
                                <div className="w-full h-4 sm:h-5 bg-stone-300/60 dark:bg-zinc-800/80 rounded-full overflow-hidden shadow-inner">
                                  <motion.div 
                                    className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full shimmer-bar relative"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${masteryRate}%` }}
                                    transition={{ duration: 1.5, ease: "easeOut" }}
                                  />
                                </div>
                              </div>
                              
                              <Link to={`/study/${deck.id}`} className="btn-3d-primary w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center shrink-0 min-w-[64px] min-h-[64px] shadow-xl border-2">
                                <Play className="w-8 h-8 sm:w-10 sm:h-10 ml-1.5" />
                              </Link>
                            </div>
                          </div>
                        </TiltCard>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-10">
              {sortedAndFilteredDecks.map((deck, idx) => {
                const masteredCount = deck.cards.filter(c => c.mastery >= 80).length;
                const masteryRate = deck.cards.length > 0 ? Math.round((masteredCount / deck.cards.length) * 100) : 0;
                
                const estimatedSeconds = deck.cards.reduce((acc, card) => {
                    const m = card.mastery || 0;
                    if (m >= 80) return acc + 10;
                    if (m >= 50) return acc + 25;
                    if (m >= 20) return acc + 40;
                    return acc + 60;
                }, 0);
                const estimatedMinutes = Math.ceil(estimatedSeconds / 60);

                return (
                  <TiltCard key={deck.id} delayIdx={idx}>
                    {/* Animated gradient border pseudo-element effect already handled by .card-3d layer logic */}
                    <div className="absolute top-4 right-4 z-20">
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin(deck.id); }}
                        className={`p-2 rounded-full transition-colors ${pinnedDecks.includes(deck.id) ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30' : 'bg-stone-100 dark:bg-zinc-800 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'}`}
                        title={pinnedDecks.includes(deck.id) ? 'Bỏ ghim' : 'Ghim danh sách này'}
                      >
                        {pinnedDecks.includes(deck.id) ? <Pin className="w-5 h-5 fill-current" /> : <Pin className="w-5 h-5" />}
                      </button>
                    </div>
                    <div className="relative z-10 flex flex-col h-full [transform:translateZ(30px)] pt-2">
                      <h4 className="font-extrabold text-2xl sm:text-3xl mb-3 pr-10 group-hover:text-amber-500 transition-colors line-clamp-2 break-all break-words leading-relaxed">{deck.title}</h4>
                      
                      <div className="flex flex-wrap items-center gap-4 mb-8">
                        <span className="text-base sm:text-xl font-mono font-black opacity-85 uppercase tracking-widest leading-relaxed">{deck.subject || "Tự chọn"}</span>
                        <span className="text-sm sm:text-base px-4 py-2.5 rounded-xl font-mono font-black uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 border-2 border-amber-500/20 leading-relaxed">
                          {getCreatorLabel(deck)}
                        </span>
                        <span className="flex items-center gap-1.5 text-sm sm:text-base px-4 py-2.5 rounded-xl font-mono font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-500/20 leading-relaxed">
                          <Clock className="w-4 h-4" />
                          {estimatedMinutes > 0 ? `~${estimatedMinutes}p` : `<1p`}
                        </span>
                      </div>
                      
                      <div className="mt-auto pt-6 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between gap-6">
                        <div className="flex flex-col gap-3 w-full mr-4">
                          <div className="flex justify-between items-center text-base sm:text-xl font-mono font-black leading-relaxed flex-wrap gap-2">
                            <span className="whitespace-nowrap">Thông thạo</span>
                            <span className="text-yellow-600 dark:text-yellow-400 whitespace-nowrap">{masteryRate}%</span>
                          </div>
                          <div className="w-full h-4 sm:h-5 bg-stone-300/60 dark:bg-zinc-800/80 rounded-full overflow-hidden shadow-inner">
                            <motion.div 
                              className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full shimmer-bar relative"
                              initial={{ width: 0 }}
                              animate={{ width: `${masteryRate}%` }}
                              transition={{ duration: 1.5, ease: "easeOut" }}
                            />
                          </div>
                        </div>
                        
                        <Link to={`/study/${deck.id}`} className="btn-3d-primary w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center shrink-0 min-w-[64px] min-h-[64px] shadow-xl border-2">
                          <Play className="w-8 h-8 sm:w-10 sm:h-10 ml-1.5" />
                        </Link>
                      </div>
                    </div>
                  </TiltCard>
                );
              })}
            </div>
          )
        ) : (
          <div className="p-12 text-center text-stone-500 space-y-6">
            <p className="text-xl sm:text-3xl font-black italic leading-loose">Không tìm thấy bộ thẻ nào phù hợp.</p>
            <button className="text-yellow-600 dark:text-yellow-400 font-black hover:underline text-xl sm:text-3xl p-4 min-h-[56px] inline-flex items-center gap-2">
                Tạo bộ thẻ mới
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
