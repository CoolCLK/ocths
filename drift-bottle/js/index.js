const BOTTLE_STORAGE_KEY = 'drift_bottles';

let bottles = [];

const initBottles = function() {
    const stored = localStorage.getItem(BOTTLE_STORAGE_KEY);
    if (stored) {
        bottles = JSON.parse(stored);
    }
}

const saveBottles = function() {
    localStorage.setItem(BOTTLE_STORAGE_KEY, JSON.stringify(bottles));
}

const formatDateTime = function(timestamp) {
    const date = new Date(timestamp);
    
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${year}年${month}月${day}日 ${hours}:${minutes}`;
}

const getRandomBottleByWeight = function() {
    if (bottles.length === 0) {
        return null;
    }
    
    const weights = bottles.map(bottle => {
    const now = Date.now();
    const daysSinceCreation = (now - bottle.createdAt) / (1000 * 60 * 60 * 24);
    
    let timeWeight = 1.0;
        if (daysSinceCreation <= 1) {
            timeWeight = 2.0;
        } else if (daysSinceCreation <= 3) {
            timeWeight = 1.5;
        } else if (daysSinceCreation <= 7) {
            timeWeight = 1.0;
        } else if (daysSinceCreation <= 14) {
            timeWeight = 0.7;
        } else if (daysSinceCreation <= 30) {
            timeWeight = 0.4;
        } else {
            timeWeight = 0.1;
        }
        
        const countWeight = 1 / (Math.log(bottle.openCount + 2));
        
        return timeWeight * countWeight;
    });
    
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < bottles.length; i++) {
        random -= weights[i];
        if (random <= 0) {
            return { bottle: bottles[i], index: i };
        }
    }
    
    return { bottle: bottles[0], index: 0 };
}

collectBottle = function() {
    const result = getRandomBottleByWeight();
    
    if (!result) {
        document.getElementById('bottleContent').innerText = '...';
    } else {
        const { bottle, index } = result;
        
        document.getElementById('bottleContent').innerHTML = `${bottle.content}<br><br>${formatDateTime(bottle.createdAt)}`;
        
        bottles[index].openCount++;
        bottles[index].lastOpenedAt = Date.now();
        
        saveBottles();
    }
    
    document.getElementById('bottleInfo').classList.remove('hide');
    setTimeout(function() { 
        document.getElementById('bottleInfo').classList.add('show'); 
    }, 0);
}

throwBottle = function() {
    const content = document.getElementById('throwContent').value.trim();
    
    if (!content) {
        return;
    }
    
    const newBottle = {
        id: bottles.length > 0 ? Math.max(...bottles.map(b => b.id)) + 1 : 1,
        content: content,
        openCount: 0,
        createdAt: Date.now()
    };
    
    bottles.push(newBottle);
    
    saveBottles();
    
    document.getElementById('throwContent').value = '';
    document.getElementById('bottleThrow').classList.remove('show');
    setTimeout(function() { document.getElementById('bottleThrow').classList.add('hide'); }, 200);
}

initBottles();

exportFile = function() {
    const data = JSON.stringify(bottles, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    a.download = `drift_bottles_backup_${timestamp}.json`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

importFile = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json, .json';
    
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (!file) {
            document.body.removeChild(input);
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const parsed = JSON.parse(e.target.result);
                
                if (!Array.isArray(parsed)) {
                    throw new Error('数据格式错误：根结构不是数组');
                }
                
                if (parsed.length > 0) {
                    const firstItem = parsed[0];
                    if (!firstItem.hasOwnProperty('content') || !firstItem.hasOwnProperty('id')) {
                        console.warn('导入的数据缺少必要字段（content/id），请确认文件正确');
                    }
                }
                
                bottles = parsed;
                saveBottles();
                
                const bottleContentEl = document.getElementById('bottleContent');
                const bottleInfoEl = document.getElementById('bottleInfo');
                if (bottleContentEl) bottleContentEl.innerText = '...';
                if (bottleInfoEl) {
                    bottleInfoEl.classList.remove('show');
                    bottleInfoEl.classList.add('hide');
                }
            } catch (err) {
                console.error(err);
            } finally {
                document.body.removeChild(input);
            }
        };
        
        reader.onerror = function() {
            document.body.removeChild(input);
        };
        
        reader.readAsText(file);
    };
    
    input.oncancel = function() {
        document.body.removeChild(input);
    };
    
    document.body.appendChild(input);
    input.click();
};