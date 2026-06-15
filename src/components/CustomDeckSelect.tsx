import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, Plus, Layers } from 'lucide-react';
import { cn } from '../lib/utils';
import { Deck } from '../lib/store';

interface CustomDeckSelectProps {
  decks: Deck[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const CustomDeckSelect: React.FC<CustomDeckSelectProps> = ({ decks, value, onChange, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const groupedDecks = decks.reduce((acc, deck) => {
    const subj = (deck.subject || "Tự chọn").trim();
    if (!acc[subj]) acc[subj] = [];
    acc[subj].push(deck);
    return acc;
  }, {} as Record<string, Deck[]>);

  const selectedDeck = decks.find(d => d.id === value);

  return (
    <div className={cn("relative", disabled && "opacity-50 pointer-events-none")} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className="w-full text-xs sm:text-sm p-3 bg-white/80 dark:bg-zinc-950/80 border border-stone-200 dark:border-zinc-700/80 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition font-bold text-left flex items-center justify-between shadow-sm"
      >
        <span className="truncate flex-1 flex items-center gap-2">
          {value === "new" ? (
             <span className="text-yellow-600 dark:text-yellow-500 flex items-center gap-1.5 whitespace-nowrap overflow-hidden text-ellipsis w-full">
                <Plus className="w-4 h-4 shrink-0" />
                <span className="truncate">+ TẠO BỘ BÀI MỚI (Lên cấu hình bên dưới)</span>
             </span>
          ) : selectedDeck ? (
             <span className="flex items-center gap-2 justify-between w-full overflow-hidden">
               <span className="truncate">{selectedDeck.title}</span>
               <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-black bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-zinc-700 shrink-0">
                 {selectedDeck.cards?.length || 0} thẻ
               </span>
             </span>
          ) : (
             <span className="text-stone-500">Chọn bộ bài...</span>
          )}
        </span>
        <ChevronDown className="w-4 h-4 text-stone-500 shrink-0 ml-2" />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 sm:mt-2 bg-white dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar py-2 top-full left-0">
           <button
             type="button"
             onClick={() => { onChange("new"); setIsOpen(false); }}
             className={cn("w-full text-left px-4 py-3 text-xs sm:text-sm font-bold text-yellow-600 dark:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-500/10 transition flex items-center gap-2", value === "new" && "bg-yellow-50 dark:bg-yellow-500/10")}
           >
             <Plus className="w-4 h-4 shrink-0" /> <span className="truncate">TẠO BỘ BÀI MỚI</span>
           </button>
           
           {Object.entries(groupedDecks).map(([subject, subjectDecks]) => (
             <div key={subject}>
               <button 
                 type="button"
                 onClick={() => setExpandedSubject(prev => prev === subject ? null : subject)}
                 className="w-full px-4 py-2 text-[10px] sm:text-xs font-black text-stone-500 dark:text-stone-400 uppercase tracking-wider bg-stone-50 dark:bg-zinc-900 border-y border-stone-100 dark:border-zinc-800 hover:bg-stone-100 dark:hover:bg-zinc-800 transition flex items-center justify-between"
               >
                 <span className="flex items-center gap-1.5 truncate pr-2">
                   <Layers className="w-3 h-3 shrink-0" /> {subject} ({subjectDecks.length} bộ)
                 </span>
                 {expandedSubject === subject ? (
                   <ChevronDown className="w-3 h-3 shrink-0" />
                 ) : (
                   <ChevronRight className="w-3 h-3 shrink-0" />
                 )}
               </button>
               
               {expandedSubject === subject && (
                 <div className="bg-white dark:bg-zinc-950 animate-in slide-in-from-top-1 fade-in duration-200">
                   {subjectDecks.map((d) => (
                     <button
                       key={d.id}
                       type="button"
                       onClick={() => { onChange(d.id); setIsOpen(false); }}
                       className={cn("w-full text-left pl-7 pr-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium hover:bg-stone-50 dark:hover:bg-zinc-900/50 transition flex items-center justify-between text-stone-800 dark:text-stone-200", value === d.id && "bg-stone-50 dark:bg-zinc-900 font-bold")}
                     >
                       <span className="truncate pr-4 flex-1">{d.title}</span>
                       <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-black bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-zinc-700 shrink-0 shadow-sm ml-2">
                         {d.cards?.length || 0}
                       </span>
                     </button>
                   ))}
                 </div>
               )}
             </div>
           ))}
        </div>
      )}
    </div>
  );
};

