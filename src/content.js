chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        const getTotalPages = async () => {
            try {
                const response = await fetch('https://jkt48.com/mypage/point-history?page=1&lang=id');
                const text = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, "text/html");
                const totalPagesElement = doc.querySelector('.page');
                const totalPagesString = totalPagesElement ? totalPagesElement.textContent.split('/').pop().trim() : "";
                const totalPages = parseInt(totalPagesString, 10) || 0;
                return totalPages;
            } catch (error) {
                console.error('Error fetching getTotalPages total pages:', error);
                return 0;
            }
        };

        async function getAllYears() {
            try {
                const totalPages = await getTotalPages().then(res => res);
                const uniqueYears = new Set();
        
                for (let page = 1; page <= totalPages; page++) {
                    const tableData = await scrapeTableData(page).then(res => res);
                    tableData.forEach(row => {
                        const year = parseInt(row[2].split(' ')[2]); // Extract year and convert to integer
                        if (year >= 2022) { // Check if year is 2022 or later
                            uniqueYears.add(year);
                        }
                    });
                }
        
                return Array.from(uniqueYears);
            } catch (error) {
                console.error("Error getAllYears:", error);
                return false;
            }
        }

        async function scrapeTableData(page) {
            try {
                const url = new URL('https://jkt48.com/mypage/point-history');
                url.searchParams.append('page', page);
                url.searchParams.append('lang', 'id');
        
                const response = await fetch(url.toString());
        
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
        
                const text = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, 'text/html');
                const tableRows = doc.querySelectorAll('.table tbody tr');
                let tableData = [];
        
                tableRows.forEach(row => {
                    const rowData = Array.from(row.querySelectorAll('td')).map(td => td.textContent.trim());
                    tableData.push(rowData);
                });
        
                return tableData;
            } catch (error) {
                console.error(`Error fetching data from page ${page}:`, error);
                return [];
            }
        }

        if (request?.action === 'login') {
            async function login() {
                try {
                    const years = await getAllYears();
                    const yrs = years.map(year => ({ year }));
            
                    return { success: true, data: yrs };
                } catch (error) {
                    console.error(error);
                    return { success: false, message: "Terjadi kesalahan pada server" };
                }
            }


            login().then(response => {
                console.log(response);
                sendResponse({ data: response });
            }).catch(error => {
                console.error('Error:', error);
                sendResponse({ success: false, message: "Terjadi kesalahan pada server" });
            });
            //sendResponse({ data: getData() });
            return true;
        }
        if (request?.action === 'scrap') {
            async function getAllTableData() {
                try {
                    const totalPages = await getTotalPages().then(res => res);
                    let allData = [];
            
                    for (let page = 1; page <= totalPages; page++) {
                        const pageData = await scrapeTableData(page).then(res => res);
                        allData = allData.concat(pageData);
                    }
            
                    return allData;
                } catch (error) {
                    console.error("Error getAllTableData:", error);
                    return false;
                }
            }

            function extractAndSumValuesByYear(data) {
                let yearSummary = {};
            
                data.forEach(row => {
                    const date = row[2]; // Tanggal Perubahan
                    const year = date.split(' ')[2]; // Asumsi format tanggal adalah 'dd MM yyyy'
                    const usage = row[3]; // Tujuan Pemakaian
                    const changeColumn = row[5];
                    const bonusMatch = changeColumn.match(/Bonus: ([0-9-+,]+)/);
                    const pointMatch = changeColumn.match(/Buy: ([0-9-+,]+)/);
            
                    let bonus = bonusMatch ? parseInt(bonusMatch[1].replace(/[+,]/g, ''), 10) : 0;
                    let point = pointMatch ? parseInt(pointMatch[1].replace(/[+,]/g, ''), 10) : 0;
            
                    if (!yearSummary[year]) {
                        yearSummary[year] = { summary: {}, totalBonus: 0, totalPoints: 0 };
                    }
            
                    if (!yearSummary[year].summary[usage]) {
                        yearSummary[year].summary[usage] = { totalBonus: 0, totalPoints: 0 };
                    }
            
                    yearSummary[year].summary[usage].totalBonus += bonus;
                    yearSummary[year].summary[usage].totalPoints += point;
                    yearSummary[year].totalBonus += bonus;
                    yearSummary[year].totalPoints += point;
                });
            
                return yearSummary;
            }

            async function myPage() {
                try {
                    const response = await fetch('https://jkt48.com/mypage');
            
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
            
                    const text = await response.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(text, 'text/html');
                    
                    // Oshi
                    const oshiElement = Array.from(doc.querySelectorAll('.entry-mypage__item--subject')).find(element =>
                        element.textContent.includes("Anggota yang paling disukai")
                    );
                    const oshiText = oshiElement ? oshiElement.nextElementSibling.textContent.trim() : '';
                    const oshi = (oshiText === "Silahkan pilih anggota yang paling disukai") ? "<s>Tidak ada</s> / 1 Jeketi" : oshiText;

                    // Foto Oshi
                    const oshiPic = "https://jkt48.com" + doc.querySelector('.entry-mypage__profile img').getAttribute('src') || 'No Image Found';

                    // Mencari jumlah kedatangan teater
                    const teaterKedatanganText = Array.from(doc.querySelectorAll('.entry-mypage__item--subject')).find(element =>
                        element.textContent.includes("Jumlah kedatangan teater")
                    )?.nextElementSibling.textContent.trim();
                    const teaterKedatangan = teaterKedatanganText ? teaterKedatanganText.match(/[\d,]+/)[0] : '';

                    // Mencari jumlah JKT48 Points
                    const jkt48PointsText = Array.from(doc.querySelectorAll('.entry-mypage__item--subject')).find(element =>
                        element.textContent.includes("Jumlah JKT48 Points")
                    )?.nextElementSibling.textContent;
                    const jkt48Points = jkt48PointsText ? jkt48PointsText.match(/[\d,]+/)[0].replace(/,/g, '') : '';

                    // Mencari Bonus Points
                    const bonusPointsText = Array.from(doc.querySelectorAll('.entry-mypage__item--subject')).find(element =>
                        element.textContent.includes("Bonus Points")
                    )?.nextElementSibling.textContent;
                    const bonusPoints = bonusPointsText ? bonusPointsText.match(/[\d,]+/)[0].replace(/,/g, '') : '';

                    return {
                        oshi,
                        teaterKedatangan,
                        jkt48Points,
                        bonusPoints,
                        oshiPic
                    };
                } catch (error) {
                    console.error("Error myPage:", error);
                    return false;
                }
            }

            async function scrapeProfile() {
                try {
                    const response = await fetch('https://jkt48.com/change/form?lang=id');
            
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
            
                    const text = await response.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(text, 'text/html');
            
                    const nickname = doc.getElementById('nickname').value;
                    return nickname;
                } catch (error) {
                    console.error('Error fetching data from profile page:', error);
                    return null;
                }
            }

            const getTheaterTotalPages = async () => {
                try {
                    const response = await fetch('https://jkt48.com/mypage/ticket-list?page=1&lang=id');
            
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
            
                    const text = await response.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(text, 'text/html');
            
                    const totalPagesElement = doc.querySelector('.page');
                    const totalPagesString = totalPagesElement ? totalPagesElement.textContent.split('/').pop().trim() : "";
                    const totalPages = parseInt(totalPagesString, 10) || 0;
            
                    return totalPages;
                } catch (error) {
                    console.error('Error fetching getTheaterTotalPages total pages:', error);
                    return 0;
                }
            };

            async function scrapeTheaterTableData(page) {
                try {
                    const response = await fetch(`https://jkt48.com/mypage/ticket-list?page=${page}&lang=id`);
            
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
            
                    const text = await response.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(text, 'text/html');
            
                    const tableRows = doc.querySelectorAll('.table tbody tr');
                    let tableData = [];
            
                    tableRows.forEach(row => {
                        const rowData = Array.from(row.querySelectorAll('td')).map(td => td.textContent.trim());
                        tableData.push(rowData);
                    });
            
                    return tableData;
                } catch (error) {
                    console.error(`Error fetching data from theater page ${page}:`, error);
                    return [];
                }
            }

            async function fetchTopSetlists(year = null) {
                try {
                    const totalPages = await getTheaterTotalPages().then(res => res);
                    let setlistCounts = {};
            
                    for (let page = 1; page <= totalPages; page++) {
                        const tableData = await scrapeTheaterTableData(page).then(res => res);
            
                        tableData.forEach(row => {
                            const entryYear = row[1].split(' ')[2];
                            if (year && entryYear !== year.toString()) {
                                return;
                            }
            
                            const setlistName = row[2];
                            const winStatus = row[0].startsWith('Detil') ? 1 : 0;
            
                            if (!setlistCounts[setlistName]) {
                                setlistCounts[setlistName] = { appearances: 0, wins: 0 };
                            }
                            setlistCounts[setlistName].appearances++;
                            setlistCounts[setlistName].wins += winStatus;
                        });
                    }
            
                    return Object.entries(setlistCounts)
                        .filter(([name, count]) => count.wins > 0)
                        .sort((a, b) => b[1].wins - a[1].wins)
                        .slice(0, 3)
                        .map(setlist => ({ name: setlist[0], wins: setlist[1].wins }));
                } catch (error) {
                    console.error("Error fetchTopSetlists:", error);
                    return false;
                }
            }

            async function calculateWinLossRate(year = null) {
                try {
                    let wins = 0;
                    let losses = 0;
                    const totalPages = await getTheaterTotalPages().then(res => res);
            
                    for (let page = 1; page <= totalPages; page++) {
                        const tableData = await scrapeTheaterTableData(page).then(res => res);
            
                        tableData.forEach(row => {
                            const entryYear = row[1].split(' ')[2]; // Assuming '15 November 2023' format
                            if (year && entryYear !== year.toString()) {
                                return;
                            }
            
                            if (row[0].startsWith('Detil')) {
                                wins++;
                            } else if (row[0] === 'Kalah') {
                                losses++;
                            }
                        });
                    }
            
                    const totalGames = wins + losses;
                    const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;
            
                    return {
                        year: year || 'All Time',
                        wins,
                        losses,
                        winRate: winRate.toFixed(2) + '%'
                    };
                } catch (error) {
                    console.error("Error calculateWinLossRate:", error);
                    return false;
                }
            }

            const getEventTotalPages = async () => {
                try {
                    const response = await fetch('https://jkt48.com/mypage/event-list?page=1&lang=id');
            
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
            
                    const text = await response.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(text, 'text/html');
            
                    const totalPagesElement = doc.querySelector('.page');
                    const totalPagesString = totalPagesElement ? totalPagesElement.textContent.split('/').pop().trim() : "";
                    const totalPages = parseInt(totalPagesString, 10) || 0;
            
                    return totalPages;
                } catch (error) {
                    console.error('Error fetching getEventTotalPages:', error);
                    return 0;
                }
            };
            
            async function scrapeEventListData(page) {
                try {
                    const response = await fetch(`https://jkt48.com/mypage/event-list?page=${page}&lang=id`);
            
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
            
                    const text = await response.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(text, 'text/html');
            
                    const tableRows = doc.querySelectorAll('.table tbody tr');
                    let tableData = [];
            
                    tableRows.forEach(row => {
                        const rowData = Array.from(row.querySelectorAll('td')).map(td => td.textContent.trim());
                        tableData.push(rowData);
                    });
            
                    return tableData;
                } catch (error) {
                    console.error(`Error fetching data from event page ${page}:`, error);
                    return [];
                }
            }

            async function fetchTopThreeEventWins(year) {
                try {
                    const totalPages = await getEventTotalPages().then(res => res);
                    let recentWins = [];
            
                    for (let page = 1; page <= totalPages; page++) {
                        const tableData = await scrapeEventListData(page).then(res => res);
            
                        tableData.forEach(row => {
                            const winStatus = row[0].includes('Detil');
                            const eventDate = row[1];
                            const eventYear = row[1].split(' ')[2];
            
                            if (winStatus && eventYear === year.toString()) {
                                const eventName = row[2];
                                recentWins.push({ name: eventName, date: eventDate });
                            }
                        });
            
                        // Break early if we already have the last three wins
                        if (recentWins.length >= 3) {
                            break;
                        }
                    }
            
                    // Sort by date and get the last three wins
                    recentWins.sort((a, b) => new Date(b.date) - new Date(a.date));
                    const lastThreeWins = recentWins.slice(0, 3);
            
                    return lastThreeWins;
                } catch (error) {
                    console.error("Error in fetchTopThreeEventWins:", error);
                    return false;
                }
            }
            
            async function fetchTopVideoCallMembersByYear(year) {
                try {
                    const response = await fetch('https://jkt48.com/mypage/handshake-session?lang=id');
            
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
            
                    const text = await response.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(text, 'text/html');
            
                    let memberTicketData = {};
                    let totalTickets = 0; // Total tickets counter
            
                    Array.from(doc.querySelectorAll('h4')).forEach(element => {
                        if (element.textContent.includes(year.toString())) {
                            const historyTable = element.nextElementSibling.querySelector('.entry-mypage__history table.table tbody');
                            Array.from(historyTable.querySelectorAll('tr')).forEach(row => {
                                const memberName = row.querySelector('td:nth-child(5)').textContent.trim();
                                const ticketsBought = parseInt(row.querySelector('td:nth-child(6)').textContent.trim(), 10) || 0;
            
                                totalTickets += ticketsBought; // Add to total tickets
            
                                if (!memberTicketData[memberName]) {
                                    memberTicketData[memberName] = 0;
                                }
                                memberTicketData[memberName] += ticketsBought;
                            });
                        }
                    });
            
                    const sortedMembers = Object.entries(memberTicketData)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 3)
                        .map(member => ({ name: member[0], tickets: member[1] }));
            
                    return { topMembers: sortedMembers, totalTickets };
                } catch (error) {
                    console.error('Error fetching data fetchTopVideoCallMembersByYear:', error);
                    return [];
                }
            }

            function formatYearData(byYear, year) {
                let result = `<b>=== ${year} ===</b>\n`;
                let totalTopup = 0;
                let totalBonus = 0;
                let totalSpend = 0;
                let totalBonusSpend = 0;
            
                if (byYear[year].summary['JKT48 Points']) {
                    totalTopup = byYear[year].summary['JKT48 Points'].totalPoints;
                    totalBonus = byYear[year].summary['JKT48 Points'].totalBonus;
                    result += `Topup: ${numbFormat(totalTopup)} P\n`;
                    if (byYear[year].summary['JKT48 Points'].totalBonus !== 0) {
                        result += `Bonus: ${numbFormat(byYear[year].summary['JKT48 Points'].totalBonus)} P\n`;
                    }
                    result += "\n";
                }
            
                for (let usage in byYear[year].summary) {
                    if (usage !== 'JKT48 Points') {
                        let spend = byYear[year].summary[usage].totalPoints;
                        let bonus = byYear[year].summary[usage].totalBonus;
                        totalSpend += Math.abs(spend);
                        totalBonusSpend += bonus;
                        result += `${usage}: ${numbFormat(spend)} P\n`;
                        if (byYear[year].summary[usage].totalBonus !== 0) {
                            result += `${usage} Bonus: ${numbFormat(byYear[year].summary[usage].totalBonus)} P\n`;
                        }
                    }
                }
            
                let sisaPoin = totalTopup - totalSpend;
                result += `\nTotal Spend: -${numbFormat(totalSpend)} P\n`;
                result += `Bonus Spend: ${numbFormat(totalBonusSpend)} P\n`;
                //result += `Sisa Point: ${numbFormat(sisaPoin)} P\n`;
                result += "====================\n\n";
            
                return { result, totalTopup, totalBonus, totalSpend, totalBonusSpend };
            }
            
            function numbFormat(number){
                return new Intl.NumberFormat(['id']).format(number);
            }

            const getData = async (req, res) => {
                try {
                    const { year } = req.body;
                    let data = {
                        theater: {},
                        events: {},
                        videoCall: {},
                        topUp: {}
                    };
                    
                    const yearSelected = year;
            
                    const [topSetlists, winLossData, topVideoCalls, profile, spendTable, myPej, lastEvent] = await Promise.all([
                        fetchTopSetlists(yearSelected),
                        calculateWinLossRate(yearSelected),
                        fetchTopVideoCallMembersByYear(yearSelected),
                        scrapeProfile(),
                        getAllTableData(),
                        myPage(),
                        fetchTopThreeEventWins(yearSelected)
                    ]);
            
                    data.name = profile;
                    data.oshi = myPej.oshi;
                    data.oshiPic = myPej.oshiPic;
            
                    // Theater
                    if (topSetlists.length !== 0) {
                        // Menambahkan Top 3 Setlist
                        data.theater.topSetlists = topSetlists.slice(0, 3).map((setlist, index) => {
                            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
                            return `${medal} ${setlist.name} - ${setlist.wins}x`;
                        });
                    } else {
                        data.theater.topSetlists = "Belum pernah Theateran 😭";
                    }

                    // Menambahkan Winrate data
                    data.theater.winrate = {
                        rate: winLossData.winRate,
                        detail: {
                            menang: winLossData.wins,
                            kalah: winLossData.losses
                        }
                    };
            
                    // Event
                    if (lastEvent.length !== 0) {
                        data.events.lastEvents = lastEvent.slice(0, 3).map(event => event.name);
                    } else {
                        data.events = "Belum pernah ikut Event 😭";
                    }
            
                    // Video Call
                    if (topVideoCalls.topMembers.length !== 0) {
                        data.videoCall.topMembers = topVideoCalls.topMembers.slice(0, 3).map((member, index) => {
                            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
                            return `${medal} ${member.name} - ${member.tickets} tiket`;
                        });
            
                        data.videoCall.totalTickets = topVideoCalls.totalTickets;
                    } else {
                        data.videoCall = "Belum pernah Video Call 😭";
                    }
            
                    // Top-up
                    const byYear = extractAndSumValuesByYear(spendTable);
                    if (byYear[yearSelected]) {
                        const spendData = formatYearData(byYear, yearSelected);
                        data.topUp = `${numbFormat(spendData.totalTopup)} P`;
                    } else {
                        data.topUp = "0 P";
                    }
                    
                    res.json({ success: true, data });
                } catch (err) {
                    console.error(err);
                    res.status(500).json({ success: false, message: "Terjadi kesalahan pada server" });
                }
            };            

            getData({ body: { year:request.year } }, { 
                json: (data) => {
                    console.log(data);
                    sendResponse({ data });
                },
                status: (code) => {
                    sendResponse({ success: false, message: "Terjadi kesalahan pada server" });
                }
            });

            return true;
        }
    }
);
