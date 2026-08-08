const fontMap = {
        'A': [" ddd ", "d   d", "ddddd", "d   d", "d   d"],
        'B': ["dddd ", "d   d", "dddd ", "d   d", "dddd "],
        'C': [" dddd", "d    ", "d    ", "d    ", " dddd"],
        'D': ["dddd ", "d   d", "d   d", "d   d", "dddd "],
        'E': ["ddddd", "d    ", "dddd ", "d    ", "ddddd"],
        'F': ["ddddd", "d    ", "dddd ", "d    ", "d    "],
        'G': [" dddd", "d    ", "d  dd", "d   d", " dddd"],
        'H': ["d   d", "d   d", "ddddd", "d   d", "d   d"],
        'I': [" ddd ", "  d  ", "  d  ", "  d  ", " ddd "],
        'J': ["  ddd", "    d", "    d", "d   d", " ddd "],
        'K': ["d   d", "d  d ", "ddd  ", "d  d ", "d   d"],
        'L': ["d    ", "d    ", "d    ", "d    ", "ddddd"],
        'M': ["d   d", "dd dd", "d d d", "d   d", "d   d"],
        'N': ["d   d", "dd  d", "d d d", "d  dd", "d   d"],
        'O': [" ddd ", "d   d", "d   d", "d   d", " ddd "],
        'P': ["dddd ", "d   d", "dddd ", "d    ", "d    "],
        'Q': [" ddd ", "d   d", "d   d", "d  d ", " ddd d"],
        'R': ["dddd ", "d   d", "dddd ", "d  d ", "d   d"],
        'S': [" dddd", "d    ", " ddd ", "    d", "dddd "],
        'T': ["ddddd", "  d  ", "  d  ", "  d  ", "  d  "],
        'U': ["d   d", "d   d", "d   d", "d   d", " ddd "],
        'V': ["d   d", "d   d", "d   d", " d d ", "  d  "],
        'W': ["d   d", "d   d", "d d d", "dd dd", "d   d"],
        'X': ["d   d", " d d ", "  d  ", " d d ", "d   d"],
        'Y': ["d   d", " d d ", "  d  ", "  d  ", "  d  "],
        'Z': ["ddddd", "   d ", "  d  ", " d   ", "ddddd"],
        ' ': ["     ", "     ", "     ", "     ", "     "],
        '?': [" ddd ", "    d", "  dd ", "     ", "  d  "],
        '.': ["     ", "     ", "     ", "  dd  ", "  dd  "],
        ',': ["     ", "     ", "     ", "  d  ", " d   "],
        '\'': ["  d  ", "  d  ", "     ", "     ", "     "],

    };
    
    //----Sesuai in aja lyric nya di variabel text, delay buat jeda per lyric lu atur bebas
    // harus pake huruf capital!!!
    const lyrics = [
        { text: "I...", delay: 4000, highlight: false },
        { text: "KNOW A PLACE...", delay: 4000, highlight: false },
        { text: "IT'S SOMEWHERE I GO", delay: 500, highlight: false },
        { text: "WHEN I NEED TO REMEMBER YOUR FACE", delay: 5000, highlight: false },
        { text: "WE GET MARRIED", delay: 5000, highlight: false },
        { text: "IN OUT HEAD", delay: 3500, highlight: false },
        { text: "SOMETHING TO DO", delay: 500, highlight: false },
        { text: "WHILE WE TRY TO RECALL", delay: 1000, highlight: false },
        { text: "HOW WE MEET", delay: 4000, highlight: true },
        { text: "CREATE ASCII PHOTOS", delay: 1000, highlight: true },
        { text: "ONE", delay: 1000, highlight: true, countdown: true, color: "#00ffcc" },
        { text: "TWO", delay: 1000, highlight: true, countdown: true, color: "#ffffff" },
        { text: "THREE", delay: 1500, highlight: true, countdown: true, color: "#ff007f" }
    ];

   function textToDString(text) {
        let resultLines = ["", "", "", "", ""];
        
        for (let char of text.toUpperCase()) {
            let matrix = fontMap[char] || fontMap[' '];
            for (let i = 0; i < 5; i++) {
                let customRow = matrix[i].replace(/d/g, 'd');
                resultLines[i] += customRow + "  "; 
            }
        }
        return resultLines.join("\n");
    }

    const lyricsBox = document.getElementById('lyrics-box');
    let currentLine = 0;
    let activeRow = null;
    const WORD_STAGGER = 220;
    const FADE_OUT_MS = 600;
    function fadeOutActiveRow(callback) {
        if (activeRow) {
            const rowToRemove = activeRow;
            activeRow = null;
            rowToRemove.classList.add('line-row-hidden');
            setTimeout(() => {
                rowToRemove.remove();
                callback();
            }, FADE_OUT_MS);
        } else {
            callback();
        }
    }

    function showNextLyric() {
        if (currentLine < lyrics.length) {
            const data = lyrics[currentLine];

            fadeOutActiveRow(() => {

                const words = data.text.split(' ').filter(w => w.length > 0);

                const lineRow = document.createElement('div');
                lineRow.className = 'line-row';
                lyricsBox.appendChild(lineRow);
                activeRow = lineRow;

                let wordIndex = 0;

                function showNextWord() {
                    if (wordIndex < words.length) {

                        const wordArt = textToDString(words[wordIndex]);

                        const wordElement = document.createElement('pre');
                        wordElement.className = 'ascii-word';
                        if (data.highlight) {
                            wordElement.classList.add('highlight');
                        }
                        if (data.countdown) {
                            wordElement.classList.add('countdown-word');
                        }
                        if (data.color) {
                            wordElement.style.color = data.color;
                        }
                        wordElement.textContent = wordArt;
                        lineRow.appendChild(wordElement);

                        setTimeout(() => {
                            wordElement.classList.add('visible');
                        }, 30);

                        wordIndex++;
                        
                        setTimeout(showNextWord, WORD_STAGGER);
                    } else {

                    currentLine++;
                    if (data.text === "THREE") {
                        setTimeout(() => {
                            startImageReveal();
                            setTimeout(showNextLyric, 500);
                        }, data.delay);
                    } else {
                        setTimeout(showNextLyric, data.delay);
                    }
                    }
                }

                showNextWord();
            });
        } else {

            fadeOutActiveRow(() => {
                const tags = document.createElement('p');
                tags.style.color = '#777';
                tags.style.marginTop = '2rem';
                tags.style.opacity = '0';
                tags.style.transition = 'opacity 0.6s ease';
                tags.textContent = "#aboutyou #the1975 #codeart #dddddd";
                lyricsBox.appendChild(tags);
                setTimeout(() => { tags.style.opacity = '1'; }, 30);
                document.getElementById('cursor').style.display = 'none';
            });
        }
    }

    setTimeout(showNextLyric, 1000);

    const box = document.getElementById("box");
    const cols = 30;
    const rows = 36;
    let pixels = [];

    function buildPixelGrid() {
        pixels = [];
        box.querySelectorAll('.pixel').forEach(p => p.remove());

        const containerWidth = box.clientWidth;
        const containerHeight = box.clientHeight;
        const w = containerWidth / cols;
        const h = containerHeight / rows;

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                let div = document.createElement("div");
                div.className = "pixel";
                div.style.left = x * w + "px";
                div.style.top = y * h + "px";
                div.style.width = (w + 0.5) + "px";
                div.style.height = (h + 0.5) + "px";
                box.appendChild(div);
                pixels.push(div);
            }
        }
    }

    function revealImagePixels() {
        const shuffled = [...pixels].sort(() => Math.random() - 0.5);
        shuffled.forEach((pixel, i) => {
            setTimeout(() => {
                const angle = (Math.random() * 50 - 25).toFixed(1);
                pixel.style.transform = `scale(0.35) rotate(${angle}deg)`;
                pixel.style.opacity = "0";
            }, i * 14);
        });
    }

    function startImageReveal() {
        box.style.display = "block";
        requestAnimationFrame(() => {
            box.classList.add('show');
            buildPixelGrid();
            setTimeout(revealImagePixels, 1500);
        });
    }