const MAX_COMBINE_SLOTS = 8; // Maximum number of adjacent slots to combine

const schedule = document.getElementById("schedule");
const friendToggles = document.getElementById("friend-toggles");

const friends = [
    { name: "Dylan", color: "blue", schedule: [
        { day: 0, start: 13, end: 14, text: "Cloud Computing"},
        { day: 1, start: 9.5, end: 10, text: "Astro"},
        { day: 1, start: 13, end: 14, text: "Cloud Computing"},
        { day: 1, start: 14, end: 16, text: "247 Lab"},
        { day: 1, start: 16, end: 17, text: "Grad Seminar"},
        { day: 1, start: 17, end: 17.5, text: "Tutorial"},
        { day: 1, start: 17.5, end: 18, text: "Status"},
        { day: 2, start: 13, end: 14, text: "Cloud Computing"},
        { day: 3, start: 16.5, end: 17.5, text: "Reading Group"},
        { day: 3, start: 10, end: 10.5, text: "Grading Meeting"},
        { day: 4, start: 13, end: 14, text: "Cloud Computing"}
    ] },
    { name: "Jonas", color: "green", schedule: [
        { day: 0, start: 13, end: 14, text: "Cloud Computing"},
        { day: 0, start: 17, end: 17.5, text: "Arch"},
        { day: 1, start: 13, end: 14, text: "Cloud Computing"},
        { day: 1, start: 14, end: 16, text: "Deep Learning"},
        { day: 1, start: 16, end: 17, text: "Grad Seminar"},
        { day: 1, start: 17, end: 17.5, text: "Tutorial"},
        { day: 1, start: 17.5, end: 18, text: "Status"},
        { day: 2, start: 13, end: 14, text: "Cloud Computing"},
        { day: 3, start: 14, end: 16, text: "Deep Learning"},
        { day: 3, start: 16.5, end: 17.5, text: "Reading Group"},
        { day: 4, start: 13, end: 14, text: "Cloud Computing"}
    ] },
    { name: "Nic", color: "red", schedule: [
        { day: 0, start: 11, end: 11.5, text: "Bio"},
        { day: 1, start: 14, end: 16, text: "Deep Learning"},
        { day: 1, start: 16, end: 17, text: "Grad Seminar"},
        { day: 1, start: 17, end: 17.5, text: "Tutorial"},
        { day: 1, start: 17.5, end: 18, text: "Status"},
        { day: 2, start: 10, end: 14, text: "241 Lab"},
        { day: 3, start: 14, end: 16, text: "Deep Learning"},
        { day: 3, start: 16.5, end: 17.5, text: "Reading Group"},
    ] },
    { name: "Katelynn", color: "purple", schedule: [
        { day: 0, start: 11, end: 12, text: "Databases"},
        { day: 0, start: 12, end: 13, text: "OOD"},
        { day: 0, start: 16, end: 16.5, text: "Climate"},
        { day: 1, start: 11, end: 12, text: "Databases"},
        { day: 1, start: 12, end: 13, text: "OOD"},
        { day: 1, start: 14, end: 16, text: "Deep Learning"},
        { day: 1, start: 17, end: 17.5, text: "Tutorial"},
        { day: 1, start: 17.5, end: 18, text: "Status"},
        { day: 2, start: 9.5, end: 10, text: "Colab Climate"},
        { day: 2, start: 11, end: 12, text: "Databases"},
        { day: 2, start: 12, end: 13, text: "OOD"},
        { day: 3, start: 14, end: 16, text: "Deep Learning"},
        { day: 3, start: 16.5, end: 17.5, text: "Reading Group"},
        { day: 4, start: 11, end: 12, text: "Databases"},
        { day: 4, start: 12, end: 13, text: "OOD"},
    ] },
];

function renderSchedule() {
    schedule.innerHTML = "";

    // Add day headers (row 1, columns 2-6)
    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    dayNames.forEach((day, index) => {
        const dayHeader = document.createElement("div");
        dayHeader.className = "schedule-header";
        dayHeader.style.gridColumn = `${index + 2}`;
        dayHeader.textContent = day;
        schedule.appendChild(dayHeader);
    });

    // Add time column (column 1, rows 2-57)
    for (let i = 8; i <= 21.75; i += 0.25) {
        const timeSlot = document.createElement("div");
        timeSlot.className = "time-slot";
        const hour = Math.floor(i);
        const minutes = (i % 1) * 60;
        timeSlot.textContent = `${hour}:${minutes === 0 ? "00" : minutes}`;
        timeSlot.style.gridRow = `${(i - 8) * 4 + 2}`;
        schedule.appendChild(timeSlot);
    }

    // Add schedule slots
    for (let day = 0; day < 5; day++) {
        for (let time = 8; time <= 21.75; time += 0.25) {
            const slot = document.createElement("div");
            slot.className = "schedule-slot";
            slot.dataset.day = day;
            slot.dataset.time = time;
            slot.style.gridColumn = `${day + 2}`;
            slot.style.gridRow = `${(time - 8) * 4 + 2}`;
            schedule.appendChild(slot);
        }
    }
}

function areEventsEqual(events1, events2) {
    if (!events1 || !events2) return false;
    if (events1.length !== events2.length) return false;
    
    const sortedEvents1 = [...events1].sort((a, b) => a.text.localeCompare(b.text));
    const sortedEvents2 = [...events2].sort((a, b) => a.text.localeCompare(b.text));
    
    return sortedEvents1.every((event, index) => 
        event.text === sortedEvents2[index].text && 
        event.color === sortedEvents2[index].color
    );
}

function findContinuousSlots(eventsBySlot, day, startTime) {
    let count = 0;
    const baseEvents = eventsBySlot[`${day}-${startTime}`];
    
    for (let i = 1; i < MAX_COMBINE_SLOTS; i++) {
        const nextTime = startTime + i * 0.25;
        const nextKey = `${day}-${nextTime}`;
        
        if (areEventsEqual(baseEvents, eventsBySlot[nextKey])) {
            count++;
        } else {
            break;
        }
    }
    
    return count + 1; // Include the initial slot
}

function isTimeSlotIdenticalAcrossWeek(eventsBySlot, time) {
    // Check if we have events for this time across all days
    const eventsForTime = [];
    for (let day = 0; day < 5; day++) {
        const key = `${day}-${time}`;
        if (!eventsBySlot[key]) return false;
        eventsForTime.push(eventsBySlot[key]);
    }
    
    // Check if all days have identical events
    return eventsForTime.every(events => areEventsEqual(events, eventsForTime[0]));
}

function findCompressibleTimeRange(eventsBySlot, startTime) {
    let endTime = startTime;
    let consecutiveSlots = 0;
    
    // Look ahead for identical time slots
    while (endTime < 21.75 && consecutiveSlots < MAX_COMBINE_SLOTS) {
        if (!isTimeSlotIdenticalAcrossWeek(eventsBySlot, endTime + 0.25)) {
            break;
        }
        endTime += 0.25;
        consecutiveSlots++;
    }
    
    // Only compress if the range is longer than 30 minutes (2 slots)
    if (endTime - startTime >= 0.5) {
        return {
            endTime,
            shouldCompress: true,
            totalSlots: consecutiveSlots + 1
        };
    }
    
    return {
        endTime: startTime + 0.25,
        shouldCompress: false,
        totalSlots: 1
    };
}
function findWeeklyPatterns(activeFriends) {
    // Create a map of time slots to their events across the week
    const weeklyPatterns = new Map();
    
    // For each time slot, collect all events across days
    for (let time = 8; time <= 21.75; time += 0.25) {
        const eventsAtTime = new Array(5).fill(null).map(() => []);
        
        activeFriends.forEach(friend => {
            friend.schedule.forEach(event => {
                if (time >= event.start && time < event.end) {
                    eventsAtTime[event.day].push({
                        text: event.text,
                        color: friend.color
                    });
                }
            });
        });
        
        // Sort events at each time slot for consistent comparison
        eventsAtTime.forEach(events => {
            events.sort((a, b) => a.text.localeCompare(b.text));
        });
        
        weeklyPatterns.set(time, eventsAtTime);
    }
    
    return weeklyPatterns;
}

function areEventArraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((event, i) => 
        event.text === arr2[i].text && 
        event.color === arr2[i].color
    );
}

function isTimeConsistent(eventsAtTime) {
    if (eventsAtTime[0].length === 0) return false;
    
    // Check if all days have the same events
    return eventsAtTime.every(dayEvents => 
        areEventArraysEqual(dayEvents, eventsAtTime[0])
    );
}

function findCompressibleRanges(weeklyPatterns) {
    const ranges = [];
    let currentRange = null;
    
    for (let time = 8; time <= 21.75; time += 0.25) {
        const eventsAtTime = weeklyPatterns.get(time);
        const isConsistent = isTimeConsistent(eventsAtTime);
        
        if (isConsistent) {
            if (!currentRange) {
                currentRange = {
                    start: time,
                    events: eventsAtTime[0]
                };
            }
        } else if (currentRange) {
            currentRange.end = time;
            if (currentRange.end - currentRange.start >= 0.5) { // 30 minutes or longer
                ranges.push(currentRange);
            }
            currentRange = null;
        }
    }
    
    // Handle case where range extends to end of day
    if (currentRange) {
        currentRange.end = 21.75;
        if (currentRange.end - currentRange.start >= 0.5) {
            ranges.push(currentRange);
        }
    }
    
    return ranges;
}
function updateSchedule() {
    renderSchedule();
    const activeFriends = friends.filter(friend =>
        document.getElementById(`toggle-${friend.name}`).checked
    );

    // Find weekly patterns and compressible ranges
    const weeklyPatterns = findWeeklyPatterns(activeFriends);
    const compressibleRanges = findCompressibleRanges(weeklyPatterns);
    
    // Collect all events by timeslot for regular processing
    const eventsBySlot = {};
    const processedSlots = new Set();
    
    activeFriends.forEach(friend => {
        friend.schedule.forEach(event => {
            for (let time = event.start; time < event.end; time += 0.25) {
                const key = `${event.day}-${time}`;
                if (!eventsBySlot[key]) eventsBySlot[key] = [];
                eventsBySlot[key].push({ ...event, color: friend.color });
            }
        });
    });

    // Process compressible ranges first
    compressibleRanges.forEach(range => {
        // Only show the first two slots of the range on Monday
        const slot = document.querySelector(
            `.schedule-slot[data-day="0"][data-time="${range.start}"]`
        );
        
        if (slot) {
            slot.style.display = 'block';
            slot.style.height = '50px'; // Two slots height
            slot.style.backgroundColor = 'white';
            slot.style.zIndex = '1';
            slot.style.position = 'relative';
            
            // Add event boxes
            range.events.forEach((event, index) => {
                const box = document.createElement("div");
                box.className = "event-box";
                box.style.backgroundColor = event.color;
                box.style.width = `${100 / range.events.length}%`;
                box.style.left = `${(100 / range.events.length) * index}%`;
                box.style.height = '100%';
                box.textContent = event.text;
                slot.appendChild(box);
            });
            
            // Hide all other slots in this range across all days
            for (let day = 0; day < 5; day++) {
                for (let time = range.start; time < range.end; time += 0.25) {
                    const key = `${day}-${time}`;
                    processedSlots.add(key);
                    
                    if (day !== 0 || time > range.start + 0.25) {
                        const hideSlot = document.querySelector(
                            `.schedule-slot[data-day="${day}"][data-time="${time}"]`
                        );
                        if (hideSlot) {
                            hideSlot.style.display = 'none';
                        }
                    }
                }
            }
        }
    });

    // Process remaining non-compressed slots
    Object.entries(eventsBySlot).forEach(([key, events]) => {
        if (processedSlots.has(key)) return;
        
        const [day, time] = key.split("-").map(Number);
        const slot = document.querySelector(
            `.schedule-slot[data-day="${day}"][data-time="${time}"]`
        );

        if (slot) {
            const continuousSlots = findContinuousSlots(eventsBySlot, day, time);
            
            // Mark slots as processed and hide them
            for (let i = 0; i < continuousSlots; i++) {
                const slotKey = `${day}-${time + i * 0.25}`;
                processedSlots.add(slotKey);
                
                if (i > 0) {
                    const laterSlot = document.querySelector(
                        `.schedule-slot[data-day="${day}"][data-time="${time + i * 0.25}"]`
                    );
                    if (laterSlot) {
                        laterSlot.style.display = 'none';
                    }
                }
            }

            // Set up the first slot
            slot.style.display = 'block';
            slot.style.height = `${25 * continuousSlots}px`;
            slot.style.position = 'relative';
            slot.style.backgroundColor = 'white';
            slot.style.zIndex = '1';

            // Add event boxes
            events.forEach((event, index) => {
                const box = document.createElement("div");
                box.className = "event-box";
                box.style.backgroundColor = event.color;
                box.style.width = `${100 / events.length}%`;
                box.style.left = `${(100 / events.length) * index}%`;
                box.style.height = '100%';
                box.textContent = event.text;
                slot.appendChild(box);
            });
        }
    });
}

function createToggles() {
    friends.forEach(friend => {
        const toggle = document.createElement("input");
        toggle.type = "checkbox";
        toggle.id = `toggle-${friend.name}`;
        toggle.checked = true;

        const label = document.createElement("label");
        label.textContent = friend.name;
        label.htmlFor = `toggle-${friend.name}`;

        const container = document.createElement("div");
        container.appendChild(toggle);
        container.appendChild(label);
        friendToggles.appendChild(container);

        toggle.addEventListener("change", updateSchedule);
    });
}

createToggles();
updateSchedule();