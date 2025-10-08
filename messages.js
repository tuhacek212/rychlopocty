// Motivační věty podle úrovně a výkonu

export const motivationalMessages = {
    expert_success: [
        "Paráda! Počítáš jako by ti šlo o život!",
        "Já to ani nestíhal vyhodnocovat. Super!",
        "Tohle není matematická olympiáda, ale kdyby byla, určitě vyhraješ!",
        "WOW! Máš v hlavě kalkulačku?",
        "Fantastický výkon! Jsi počítací stroj!",
        "Neuvěřitelné! Rychlejší než můj procesor!",
        "Experti by se od tebe měli učit!",
        "To je speed! Možná bys mohl trénovat olympioniky!",
        "Perfektní! Tvůj mozek běží na plné obrátky!",
        "Brutální čas! Gratuluji k tomuhle výkonu!",
        "Einstein by byl hrdý!",
        "Tohle je mistrovský level!",
        "Jsi matematický ninja!"
    ],
    
    obtizna_success: [
        "Skvělá práce! To už je úroveň!",
        "Výborně! Vidím, že máš talent!",
        "Tohle je už pořádný level! Respekt!",
        "Obtížná? Pro tebe byla easy!",
        "Impozantní! Máš na to být expert!",
        "Super čas! Zkus teď Experta!",
        "Výborný výkon! Jdeš nahoru!",
        "Tohle se povedlo! Expert na tebe čeká!",
        "Respect! Jsi na správné cestě nahoru!",
        "Skvěle! Další level už je na dohled!"
    ],
    
    stredni_success: [
        "Dobře ti to jde! Co takhle zkusit Obtížnou?",
        "Výborně! Myslím, že zvládneš i těžší úroveň!",
        "Super! Střední máš v kapse, jdi výš!",
        "To nebylo špatné! Zkus něco náročnějšího!",
        "Pěkný čas! Obtížná na tebe čeká!",
        "Jde ti to! Čas posunout se výš!",
        "Solidní výkon! Co takhle další level?",
        "Máš na víc! Zkus těžší režim!",
        "Střední zvládáš, teď výš!",
        "Dobrá práce! Další úroveň tě volá!"
    ],
    
    lehka_success: [
        "To nebylo špatné, zkus teď těžší úroveň!",
        "Lehká by ti šla, ale co takhle zkusit těžší?",
        "Dobrý začátek! Odvážíš se na Střední?",
        "Pěkně! Myslím, že zvládneš víc!",
        "Prima! Co takhle něco náročnějšího?",
        "Lehká je pro tebe moc easy! Jdi výš!",
        "Super start! Zkus teď Střední úroveň!",
        "Dobře! Ale myslím, že máš na víc!",
        "Lehká je rozehřátí, zkus něco těžšího!",
        "To zvládneš i se zavázanýma očima! Jdi výš!"
    ],
    
    during_test: [
        "Přidej! Makej!",
        "Zaber ty máslo!",
        "Ty snad u toho svačíš!",
        "Nekoukej na čas a počítej!",
        "To je ale makačka!",
        "Nechceš abych ti poradil, že ne?",
        "Rychleji! Mám tu celý den!",
        "Hele, to není závodění se šnekem!",
        "Tak honem, honem!",
        "Co to máš, spánkovou nemoc?",
        "Soustřeď se! Tohle není procházka růžovým sadem!",
        "Tempo! Tempo!",
        "Myslíš si, že mám celý den čas?",
        "Ty chceš, abych tady zestárnul?",
        "Spi doma, tady se počítá!",
        "Hledáš ta správná čísla?",
        "Nemysli! Počítej!",
        "Hele, kalkulačka by to spočítala rychlejc!",
        "Tak co, bude to ještě to dneska?",
        "Soustředění! To není pohádka na dobrou noc!",
        "Hurá! Ať vidím ty prsteníčky létat!",
        "Pohni kostrou!",
        "Jedem! Jedem!",
        "Hele, tady se nesní!",
        "Co je, ztratil ses v číslech?",
        "Budeme to mít dnes nebo zítra?",
        "Nečti si a počítej!",
        "To není úkol na celou hodinu!",
        "Koukám jak se u toho trápíš!",
        "Dělej ať stihneš taky něco dalšího dneska!",
        "To snad není nic tak složitého ne?",
        "Klid, nespěchej ... já si počkám!",
        "Dyť je to učivo základní školy!",
        "Učitelka matiky měla pravdu, bude z tebe jůtuber!"
    ],
    
    quit_test: [
        "Už tě to nebavilo?",
        "Proč kazíš tak skvělou zábavu?!?",
        "V McDonaldu nabírají na hranolky...",
        "Vzdávat se není řešení!",
        "To už? Ale vždyť jsi teprve začal!",
        "Trochu snahy by neuškodilo!",
        "Tak rychle se vzdáváš?",
        "Příště to dotáhni do konce!",
        "Někdo nemá dost vytrvalosti...",
        "A právě když to začínalo být zajímavé!",
        "Slabota! Zkus to znovu!",
        "Opravdu? Už teď?",
        "To je škoda, mohlo to být skvělý!",
        "Nebuď taková mrkev!",
        "Snad se nestydíš...",
        "Kde je tvůj bojovný duch?",
        "Tak tohle byl fakt rychlý útěk!",
        "Příště to zkus dokončit!"
    ],
    
    general_good: [
        "Pěkná práce!",
        "Super výkon!",
        "Výborně!",
        "To se povedlo!",
        "Skvělé!",
        "Keep going!",
        "Makáš dobře!",
        "Jde ti to!"
    ]
};

export function getMotivationalMessage(mode, success, wasQuit = false) {
    let messagePool = [];
    
    if (wasQuit) {
        messagePool = motivationalMessages.quit_test;
    } else if (success) {
        if (mode === 'Expert') {
            messagePool = motivationalMessages.expert_success;
        } else if (mode === 'Obtížná') {
            messagePool = motivationalMessages.obtizna_success;
        } else if (mode === 'Střední') {
            messagePool = motivationalMessages.stredni_success;
        } else if (mode === 'Lehká') {
            messagePool = motivationalMessages.lehka_success;
        } else {
            messagePool = motivationalMessages.general_good;
        }
    } else {
        messagePool = motivationalMessages.general_good;
    }
    
    // Náhodný výběr z pole
    const randomIndex = Math.floor(Math.random() * messagePool.length);
    return messagePool[randomIndex];
}

export function getDuringTestMessage() {
    const messages = motivationalMessages.during_test;
    const randomIndex = Math.floor(Math.random() * messages.length);
    return messages[randomIndex];
}