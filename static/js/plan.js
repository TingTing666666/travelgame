let map;
let marker;
document.addEventListener('DOMContentLoaded', function () {
    let map;
    let marker;

    // Initialize variables
    let selectedAttractions = [];
    let itineraryData = {};
    let budgetTotal = 0;
    let budgetUsed = 0;
    let attractionsData = [];
    let currentDay = 1;
    let totalDays = 0;
    let allProvincesData = {};

    // DOM Elements
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const budgetInput = document.getElementById('budget');
    const travelersInput = document.getElementById('travelers');
    const provinceSelect = document.getElementById('province-select');
    const attractionsContainer = document.getElementById('attractions-container');
    const filterProvinceSelect = document.getElementById('filter-province');
    const filterTypeSelect = document.getElementById('filter-type');
    const daysTabsContainer = document.getElementById('days-tabs');
    const dayContentsContainer = document.getElementById('day-contents');
    const activityNameInput = document.getElementById('activity-name');
    const activityTimeInput = document.getElementById('activity-time');
    const activityLocationInput = document.getElementById('activity-location');
    const activityCostInput = document.getElementById('activity-cost');
    const activityTypeSelect = document.getElementById('activity-type');
    const activityNotesInput = document.getElementById('activity-notes');
    const addActivityBtn = document.getElementById('add-activity-btn');
    const cancelActivityBtn = document.getElementById('cancel-activity');
    const autoGenerateBtn = document.getElementById('auto-generate-btn');
    const generatePlanBtn = document.getElementById('generate-plan-btn');
    const savePlanBtn = document.getElementById('save-plan-btn');
    const sharePlanBtn = document.getElementById('share-plan-btn');
    const budgetBarElement = document.getElementById('budget-bar');
    const usedBudgetElement = document.getElementById('used-budget');
    const totalBudgetElement = document.getElementById('total-budget');
    const budgetBreakdownElement = document.getElementById('budget-breakdown');
    const toastMessage = document.getElementById('toast-message');
    const filterPeopleSelect = document.getElementById('filter-people');
    const filterBudgetSelect = document.getElementById('filter-budget');


    // Initialize date inputs
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    startDateInput.valueAsDate = today;
    endDateInput.valueAsDate = nextWeek;

    // Event Listeners
    startDateInput.addEventListener('change', calculateTripDays);
    endDateInput.addEventListener('change', calculateTripDays);
    budgetInput.addEventListener('change', updateBudgetTotal);
    provinceSelect.addEventListener('change', handleProvinceChange);
    filterProvinceSelect.addEventListener('change', handleFilterChange);
    filterTypeSelect.addEventListener('change', handleFilterChange);
    autoGenerateBtn.addEventListener('click', autoGenerateItinerary);
    generatePlanBtn.addEventListener('click', generateCustomPlan);
    addActivityBtn.addEventListener('click', addActivity);
    cancelActivityBtn.addEventListener('click', resetActivityForm);
    savePlanBtn.addEventListener('click', savePlan);
    sharePlanBtn.addEventListener('click', sharePlan);
    filterPeopleSelect.addEventListener('change', handleFilterChange);
    filterBudgetSelect.addEventListener('change', handleFilterChange);

    // Initialize page
    calculateTripDays();
    loadAllAttractionsData();

    // 初始化地图
    if (typeof AMap !== 'undefined') {
        initializeMap();
    } else {
        console.log('AMap not loaded yet, will initialize when available');
    }

    // 地图相关函数定义
    function initializeMap() {
        map = new AMap.Map('real-map', {
            zoom: 6,
            center: [116.397428, 39.90923],
            mapStyle: 'amap://styles/normal'
        });

        const searchInput = document.getElementById('map-search');
        const searchBtn = document.getElementById('search-btn');

        if (searchBtn && searchInput) {
            searchBtn.addEventListener('click', function () {
                const keyword = searchInput.value.trim();
                if (keyword) {
                    searchLocation(keyword);
                }
            });

            searchInput.addEventListener('keypress', function (e) {
                if (e.key === 'Enter') {
                    const keyword = this.value.trim();
                    if (keyword) {
                        searchLocation(keyword);
                    }
                }
            });
        }
    }

// 搜索位置
    function searchLocation(keyword) {
        AMap.plugin('AMap.Geocoder', function () {
            const geocoder = new AMap.Geocoder({
                city: '全国'
            });

            geocoder.getLocation(keyword, function (status, result) {
                if (status === 'complete' && result.geocodes.length) {
                    const location = result.geocodes[0].location;
                    map.setCenter(location);
                    map.setZoom(10);

                    // 清除之前的标记
                    if (marker) {
                        map.remove(marker);
                    }

                    // 添加新标记
                    marker = new AMap.Marker({
                        position: location,
                        title: keyword
                    });

                    map.add(marker);
                } else {
                    showToast('Location not found');
                }
            });
        });
    }

    // 修改locateToProvince函数，使用中文省份名
    function locateToProvince(provinceId) {
        if (provinceId && map) {
            // 使用省份中文名进行搜索，因为高德地图对中文地名识别更好
            searchLocation(provinceId);
        }
    }

    // 加载高德地图API后初始化地图
    if (typeof AMap !== 'undefined') {
        initializeMap();
    } else {
        // 动态加载高德地图API
        const script = document.createElement('script');
        script.src = 'https://webapi.amap.com/maps?v=1.4.15&key=YOUR_AMAP_KEY&callback=initializeMap';
        document.head.appendChild(script);
    }

    function calculateTripDays() {
        const startDate = new Date(startDateInput.value);
        const endDate = new Date(endDateInput.value);

        if (startDate > endDate) {
            showToast("End date cannot be before start date");
            endDateInput.valueAsDate = new Date(startDate.getTime() + 86400000);
            return;
        }

        const diffTime = Math.abs(endDate - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        totalDays = diffDays;
        updateDayTabs(startDate, diffDays);
    }

    function updateDayTabs(startDate, numberOfDays) {
        daysTabsContainer.innerHTML = '';
        dayContentsContainer.innerHTML = '';

        for (let i = 0; i < numberOfDays; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const formattedDate = date.toLocaleDateString('en-US', {month: 'short', day: 'numeric'});

            // Create tab
            const dayTab = document.createElement('div');
            dayTab.className = 'day-tab';
            dayTab.dataset.day = i + 1;
            dayTab.textContent = `Day ${i + 1} (${formattedDate})`;

            // Create day content
            const dayContent = document.createElement('div');
            dayContent.className = 'day-content';
            dayContent.dataset.day = i + 1;

            const timeline = document.createElement('div');
            timeline.className = 'timeline';
            timeline.id = `timeline-day-${i + 1}`;

            if (i === 0) {
                dayTab.classList.add('active');
                dayContent.classList.add('active');
            }

            dayTab.addEventListener('click', function () {
                document.querySelectorAll('.day-tab').forEach(tab => tab.classList.remove('active'));
                document.querySelectorAll('.day-content').forEach(content => content.classList.remove('active'));

                this.classList.add('active');
                document.querySelector(`.day-content[data-day="${this.dataset.day}"]`).classList.add('active');

                currentDay = parseInt(this.dataset.day);
            });

            dayContent.appendChild(timeline);
            daysTabsContainer.appendChild(dayTab);
            dayContentsContainer.appendChild(dayContent);
        }

        for (let i = 1; i <= numberOfDays; i++) {
            if (!itineraryData[i]) {
                itineraryData[i] = [];
            }
        }

        currentDay = 1;
    }

    function updateBudgetTotal() {
        budgetTotal = parseFloat(budgetInput.value) || 0;
        updateBudgetDisplay();
    }

    function loadAllAttractionsData() {
        // Load all attractions data for filtering
        const provinces = Array.from(provinceSelect.options).map(option => option.value).filter(val => val);

        provinces.forEach(provinceId => {
            fetchAttractionsForProvince(provinceId);
        });
    }

    function fetchAttractionsForProvince(provinceId) {
        fetch(`/api/attractions?province_id=${provinceId}`)
            .then(response => response.json())
            .then(data => {
                if (!allProvincesData[provinceId]) {
                    allProvincesData[provinceId] = [];
                }
                allProvincesData[provinceId] = data;

                // Update attractions data for filtering
                attractionsData = [];
                Object.values(allProvincesData).forEach(provinceAttractions => {
                    attractionsData = [...attractionsData, ...provinceAttractions];
                });

                handleFilterChange();
            })
            .catch(error => {
                console.error("Error fetching attractions:", error);
                // Generate dummy data for demo
                const dummyAttractions = generateDummyAttractions(provinceId);
                allProvincesData[provinceId] = dummyAttractions;
                attractionsData = [...attractionsData, ...dummyAttractions];
                handleFilterChange();
            });
    }

    function generateDummyAttractions(provinceId) {
        return [
            {
                id: `${provinceId}-sight1`,
                province_id: provinceId,
                attraction_name: `${provinceId} Historical Museum`,
                english_name: `${provinceId} Historical Museum`,
                people: 4,
                budget: 80,
                time: 2,
                type: 'play'
            },
            {
                id: `${provinceId}-sight2`,
                province_id: provinceId,
                attraction_name: `${provinceId} Cultural Park`,
                english_name: `${provinceId} Cultural Park`,
                people: 4,
                budget: 60,
                time: 3,
                type: 'play'
            },
            {
                id: `${provinceId}-food1`,
                province_id: provinceId,
                attraction_name: `${provinceId} Traditional Restaurant`,
                english_name: `${provinceId} Traditional Restaurant`,
                people: 4,
                budget: 120,
                time: 1.5,
                type: 'food'
            },
            {
                id: `${provinceId}-food2`,
                province_id: provinceId,
                attraction_name: `${provinceId} Street Food Market`,
                english_name: `${provinceId} Street Food Market`,
                people: 2,
                budget: 60,
                time: 1,
                type: 'food'
            },
            {
                id: `${provinceId}-stay1`,
                province_id: provinceId,
                attraction_name: `${provinceId} Luxury Hotel`,
                english_name: `${provinceId} Luxury Hotel`,
                people: 2,
                budget: 800,
                time: 24,
                type: 'stay'
            }
        ];
    }

    // 修改handleProvinceChange函数
    function handleProvinceChange() {
        const selectedProvince = provinceSelect.value;
        if (selectedProvince) {
            if (!allProvincesData[selectedProvince]) {
                fetchAttractionsForProvince(selectedProvince);
            }
            // 定位到选择的省份
            if (map) {
                locateToProvince(selectedProvince);
            }
        }
    }

    function handleFilterChange() {
        const selectedProvince = filterProvinceSelect.value;
        const selectedType = filterTypeSelect.value;
        const selectedPeople = filterPeopleSelect.value;
        const selectedBudget = filterBudgetSelect.value;

        displayFilteredAttractions(selectedProvince, selectedType, selectedPeople, selectedBudget);
    }

    function displayFilteredAttractions(provinceFilter, typeFilter, peopleFilter, budgetFilter) {
        attractionsContainer.innerHTML = '';

        if (attractionsData.length === 0) {
            attractionsContainer.innerHTML = '<div class="empty-state">Loading attractions...</div>';
            return;
        }

        let filteredAttractions = attractionsData;

        if (provinceFilter) {
            filteredAttractions = filteredAttractions.filter(attraction =>
                attraction.province_id === provinceFilter
            );
        }

        if (typeFilter !== 'all') {
            filteredAttractions = filteredAttractions.filter(attraction =>
                attraction.type === typeFilter
            );
        }

        if (peopleFilter) {
            const peopleNum = parseInt(peopleFilter);
            filteredAttractions = filteredAttractions.filter(attraction =>
                attraction.people >= peopleNum
            );
        }

        if (budgetFilter) {
            filteredAttractions = filteredAttractions.filter(attraction => {
                const budget = attraction.budget;
                switch (budgetFilter) {
                    case '0-50':
                        return budget >= 0 && budget <= 50;
                    case '50-100':
                        return budget > 50 && budget <= 100;
                    case '100-200':
                        return budget > 100 && budget <= 200;
                    case '200+':
                        return budget > 200;
                    default:
                        return true;
                }
            });
        }

        if (filteredAttractions.length === 0) {
            attractionsContainer.innerHTML = '<div class="empty-state">No attractions found for the selected filters.</div>';
            return;
        }

        filteredAttractions.forEach(attraction => {
            const attractionCard = document.createElement('div');
            attractionCard.className = 'attraction-card';
            if (selectedAttractions.some(selected => selected.id === attraction.id)) {
                attractionCard.classList.add('selected');
            }

            const attractionInfo = document.createElement('div');
            attractionInfo.className = 'attraction-info';

            const name = document.createElement('div');
            name.className = 'attraction-name';
            name.textContent = attraction.english_name;

            const details = document.createElement('div');
            details.className = 'attraction-details';
            details.textContent = `${attraction.time} hours • ¥${attraction.budget} • Up to ${attraction.people} people`;

            const typeBadge = document.createElement('span');
            typeBadge.className = 'attraction-badge';
            typeBadge.textContent = attraction.type.charAt(0).toUpperCase() + attraction.type.slice(1);

            attractionInfo.appendChild(name);
            attractionInfo.appendChild(details);

            attractionCard.appendChild(attractionInfo);
            attractionCard.appendChild(typeBadge);

            attractionCard.addEventListener('click', function () {
                if (attractionCard.classList.contains('selected')) {
                    attractionCard.classList.remove('selected');
                    selectedAttractions = selectedAttractions.filter(a => a.id !== attraction.id);
                } else {
                    attractionCard.classList.add('selected');
                    selectedAttractions.push(attraction);
                }
            });

            attractionsContainer.appendChild(attractionCard);
        });
    }

    function autoGenerateItinerary() {
        const selectedProvince = provinceSelect.value;

        if (!selectedProvince) {
            showToast("Please select a province first");
            return;
        }

        if (totalDays === 0) {
            showToast("Please set your trip dates first");
            return;
        }

        // Clear existing itinerary
        for (let i = 1; i <= totalDays; i++) {
            itineraryData[i] = [];
        }
        budgetUsed = 0;

        const provinceAttractions = allProvincesData[selectedProvince] || [];
        const travelers = parseInt(travelersInput.value) || 2;

        const playAttractions = provinceAttractions.filter(a => a.type === 'play');
        const foodAttractions = provinceAttractions.filter(a => a.type === 'food');
        const stayAttractions = provinceAttractions.filter(a => a.type === 'stay');

        // Generate itinerary for each day
        for (let day = 1; day <= totalDays; day++) {
            const dayActivities = [];

            // Morning activity (play)
            if (playAttractions.length > 0) {
                const playIndex = ((day - 1) * 2) % playAttractions.length;
                const attraction = playAttractions[playIndex];
                dayActivities.push({
                    id: Date.now() + day * 1000 + 1,
                    name: attraction.english_name,
                    timeRange: '09:00 - 12:00',
                    location: attraction.province_id,
                    cost: attraction.budget * travelers,
                    type: 'play',
                    notes: ''
                });
                budgetUsed += attraction.budget * travelers;
            }

            // Lunch (food)
            if (foodAttractions.length > 0) {
                const foodIndex = ((day - 1) * 2) % foodAttractions.length;
                const attraction = foodAttractions[foodIndex];
                dayActivities.push({
                    id: Date.now() + day * 1000 + 2,
                    name: attraction.english_name,
                    timeRange: '12:30 - 14:00',
                    location: attraction.province_id,
                    cost: attraction.budget * travelers,
                    type: 'food',
                    notes: 'Lunch'
                });
                budgetUsed += attraction.budget * travelers;
            }

            // Afternoon activity (play)
            if (playAttractions.length > 1) {
                const playIndex = ((day - 1) * 2 + 1) % playAttractions.length;
                const attraction = playAttractions[playIndex];
                dayActivities.push({
                    id: Date.now() + day * 1000 + 3,
                    name: attraction.english_name,
                    timeRange: '14:30 - 17:00',
                    location: attraction.province_id,
                    cost: attraction.budget * travelers,
                    type: 'play',
                    notes: ''
                });
                budgetUsed += attraction.budget * travelers;
            }

            // Dinner (food)
            if (foodAttractions.length > 1) {
                const foodIndex = ((day - 1) * 2 + 1) % foodAttractions.length;
                const attraction = foodAttractions[foodIndex];
                dayActivities.push({
                    id: Date.now() + day * 1000 + 4,
                    name: attraction.english_name,
                    timeRange: '18:00 - 19:30',
                    location: attraction.province_id,
                    cost: attraction.budget * travelers,
                    type: 'food',
                    notes: 'Dinner'
                });
                budgetUsed += attraction.budget * travelers;
            }

            // Accommodation (stay)
            if (stayAttractions.length > 0) {
                const stayIndex = (day - 1) % stayAttractions.length;
                const attraction = stayAttractions[stayIndex];
                dayActivities.push({
                    id: Date.now() + day * 1000 + 5,
                    name: attraction.english_name,
                    timeRange: '20:00 - 08:00',
                    location: attraction.province_id,
                    cost: attraction.budget,
                    type: 'stay',
                    notes: 'Overnight stay'
                });
                budgetUsed += attraction.budget;
            }

            itineraryData[day] = dayActivities;
        }

        // Render all days
        for (let day = 1; day <= totalDays; day++) {
            renderItineraryDay(day);
        }

        updateBudgetDisplay();
        showToast("Auto itinerary generated successfully!");
    }

    function generateCustomPlan() {
        if (selectedAttractions.length === 0) {
            showToast("Please select some attractions first");
            return;
        }

        // Clear existing itinerary
        for (let i = 1; i <= totalDays; i++) {
            itineraryData[i] = [];
        }
        budgetUsed = 0;

        const travelers = parseInt(travelersInput.value) || 2;
        const playAttractions = selectedAttractions.filter(a => a.type === 'play');
        const foodAttractions = selectedAttractions.filter(a => a.type === 'food');
        const stayAttractions = selectedAttractions.filter(a => a.type === 'stay');

        let playIndex = 0;
        let foodIndex = 0;
        let stayIndex = 0;

        for (let day = 1; day <= totalDays; day++) {
            const dayActivities = [];

            // Morning activity
            if (playIndex < playAttractions.length) {
                const attraction = playAttractions[playIndex];
                dayActivities.push({
                    id: Date.now() + day * 1000 + playIndex,
                    name: attraction.english_name,
                    timeRange: '09:00 - 12:00',
                    location: attraction.province_id,
                    cost: attraction.budget * travelers,
                    type: 'play',
                    notes: ''
                });
                playIndex++;
                budgetUsed += attraction.budget * travelers;
            }

            // Lunch
            if (foodIndex < foodAttractions.length) {
                const attraction = foodAttractions[foodIndex];
                dayActivities.push({
                    id: Date.now() + day * 1000 + 100 + foodIndex,
                    name: attraction.english_name,
                    timeRange: '12:30 - 14:00',
                    location: attraction.province_id,
                    cost: attraction.budget * travelers,
                    type: 'food',
                    notes: 'Lunch'
                });
                foodIndex++;
                budgetUsed += attraction.budget * travelers;
            }

            // Afternoon activity
            if (playIndex < playAttractions.length) {
                const attraction = playAttractions[playIndex];
                dayActivities.push({
                    id: Date.now() + day * 1000 + 200 + playIndex,
                    name: attraction.english_name,
                    timeRange: '14:30 - 17:00',
                    location: attraction.province_id,
                    cost: attraction.budget * travelers,
                    type: 'play',
                    notes: ''
                });
                playIndex++;
                budgetUsed += attraction.budget * travelers;
            }

            // Dinner
            if (foodIndex < foodAttractions.length) {
                const attraction = foodAttractions[foodIndex];
                dayActivities.push({
                    id: Date.now() + day * 1000 + 300 + foodIndex,
                    name: attraction.english_name,
                    timeRange: '18:00 - 19:30',
                    location: attraction.province_id,
                    cost: attraction.budget * travelers,
                    type: 'food',
                    notes: 'Dinner'
                });
                foodIndex++;
                budgetUsed += attraction.budget * travelers;
            }

            // Accommodation
            if (stayIndex < stayAttractions.length) {
                const attraction = stayAttractions[stayIndex];
                dayActivities.push({
                    id: Date.now() + day * 1000 + 400 + stayIndex,
                    name: attraction.english_name,
                    timeRange: '20:00 - 08:00',
                    location: attraction.province_id,
                    cost: attraction.budget,
                    type: 'stay',
                    notes: 'Overnight stay'
                });
                stayIndex++;
                budgetUsed += attraction.budget;
            }

            itineraryData[day] = dayActivities;
        }

        // Render all days
        for (let day = 1; day <= totalDays; day++) {
            renderItineraryDay(day);
        }

        updateBudgetDisplay();
        showToast("Custom itinerary generated successfully!");
    }

    function renderItineraryDay(day) {
        const timeline = document.getElementById(`timeline-day-${day}`);
        if (!timeline) return;

        timeline.innerHTML = '';

        const dayActivities = itineraryData[day] || [];

        if (dayActivities.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.textContent = 'No activities planned for this day.';
            timeline.appendChild(emptyState);
            return;
        }

        dayActivities.sort((a, b) => {
            const timeA = a.timeRange.split(' - ')[0];
            const timeB = b.timeRange.split(' - ')[0];
            return timeA.localeCompare(timeB);
        });

        dayActivities.forEach(activity => {
            const timelineItem = document.createElement('div');
            timelineItem.className = 'timeline-item';
            timelineItem.dataset.id = activity.id;

            const timelineTime = document.createElement('span');
            timelineTime.className = 'timeline-time';
            timelineTime.textContent = activity.timeRange;

            const timelineTitle = document.createElement('h4');
            timelineTitle.textContent = activity.name;

            const timelineLocation = document.createElement('p');
            if (activity.location) {
                timelineLocation.textContent = `Location: ${activity.location}`;
            }

            const timelineNotes = document.createElement('p');
            if (activity.notes) {
                timelineNotes.textContent = activity.notes;
            }

            const timelineBadge = document.createElement('span');
            timelineBadge.className = `timeline-item-badge ${activity.type}`;
            timelineBadge.textContent = activity.type.charAt(0).toUpperCase() + activity.type.slice(1);

            const timelineActions = document.createElement('div');
            timelineActions.className = 'timeline-actions';

            const editBtn = document.createElement('button');
            editBtn.className = 'timeline-action-btn edit';
            editBtn.textContent = 'Edit';
            editBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                editActivity(activity, day);
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'timeline-action-btn delete';
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                deleteActivity(activity.id, day);
            });

            timelineActions.appendChild(editBtn);
            timelineActions.appendChild(deleteBtn);

            timelineItem.appendChild(timelineTime);
            timelineItem.appendChild(timelineTitle);
            if (activity.location) timelineItem.appendChild(timelineLocation);
            if (activity.notes) timelineItem.appendChild(timelineNotes);
            timelineItem.appendChild(timelineBadge);
            timelineItem.appendChild(timelineActions);

            timeline.appendChild(timelineItem);
        });
    }

    function editActivity(activity, day) {
        activityNameInput.value = activity.name;
        activityTimeInput.value = activity.timeRange;
        activityLocationInput.value = activity.location || '';
        activityCostInput.value = activity.cost;
        activityTypeSelect.value = activity.type;
        activityNotesInput.value = activity.notes || '';

        addActivityBtn.textContent = 'Update';
        addActivityBtn.dataset.editId = activity.id;
        addActivityBtn.dataset.editDay = day;

        document.querySelector('.add-activity').scrollIntoView({behavior: 'smooth'});
    }

    function deleteActivity(activityId, day) {
        const activityIndex = itineraryData[day].findIndex(a => a.id == activityId);

        if (activityIndex === -1) {
            showToast("Activity not found");
            return;
        }

        const oldCost = itineraryData[day][activityIndex].cost;
        budgetUsed -= oldCost;

        itineraryData[day].splice(activityIndex, 1);

        renderItineraryDay(day);
        updateBudgetDisplay();

        showToast("Activity deleted successfully!");
    }

    function addActivity() {
        const name = activityNameInput.value.trim();
        const timeRange = activityTimeInput.value.trim();
        const location = activityLocationInput.value.trim();
        const cost = parseFloat(activityCostInput.value) || 0;
        const type = activityTypeSelect.value;
        const notes = activityNotesInput.value.trim();

        if (!name || !timeRange) {
            showToast("Please enter activity name and time");
            return;
        }

        if (addActivityBtn.dataset.editId) {
            // Update existing activity
            const editId = addActivityBtn.dataset.editId;
            const editDay = parseInt(addActivityBtn.dataset.editDay);

            const activityIndex = itineraryData[editDay].findIndex(a => a.id == editId);
            if (activityIndex !== -1) {
                const oldCost = itineraryData[editDay][activityIndex].cost;
                budgetUsed = budgetUsed - oldCost + cost;

                itineraryData[editDay][activityIndex] = {
                    ...itineraryData[editDay][activityIndex],
                    name,
                    timeRange,
                    location,
                    cost,
                    type,
                    notes
                };

                renderItineraryDay(editDay);
                updateBudgetDisplay();
                showToast("Activity updated successfully!");
            }
        } else {
            // Add new activity
            const activity = {
                id: Date.now(),
                name,
                timeRange,
                location,
                cost,
                type,
                notes
            };

            if (!itineraryData[currentDay]) {
                itineraryData[currentDay] = [];
            }

            itineraryData[currentDay].push(activity);

            renderItineraryDay(currentDay);

            budgetUsed += cost;
            updateBudgetDisplay();

            showToast("Activity added successfully!");
        }

        resetActivityForm();
    }

    function resetActivityForm() {
        activityNameInput.value = '';
        activityTimeInput.value = '';
        activityLocationInput.value = '';
        activityCostInput.value = '';
        activityTypeSelect.value = 'play';
        activityNotesInput.value = '';

        addActivityBtn.textContent = 'Add';
        delete addActivityBtn.dataset.editId;
        delete addActivityBtn.dataset.editDay;
    }

    function updateBudgetDisplay() {
        usedBudgetElement.textContent = `¥${formatNumber(budgetUsed)}`;
        totalBudgetElement.textContent = `¥${formatNumber(budgetTotal)}`;

        let percentage = 0;
        if (budgetTotal > 0) {
            percentage = Math.min(100, (budgetUsed / budgetTotal) * 100);
        }
        budgetBarElement.style.width = `${percentage}%`;

        if (percentage < 50) {
            budgetBarElement.style.backgroundColor = 'var(--primary-color)';
        } else if (percentage < 80) {
            budgetBarElement.style.backgroundColor = '#FFB946';
        } else {
            budgetBarElement.style.backgroundColor = '#ff6b6b';
        }

        const breakdown = {
            play: 0,
            food: 0,
            stay: 0,
            transport: 0
        };

        for (const day in itineraryData) {
            itineraryData[day].forEach(activity => {
                if (breakdown[activity.type] !== undefined) {
                    breakdown[activity.type] += activity.cost;
                }
            });
        }

        budgetBreakdownElement.innerHTML = '';

        for (const [category, amount] of Object.entries(breakdown)) {
            if (amount > 0) {
                const categoryDiv = document.createElement('div');
                categoryDiv.className = 'budget-category';

                const categoryName = document.createElement('span');
                categoryName.textContent = category.charAt(0).toUpperCase() + category.slice(1);

                const categoryAmount = document.createElement('span');
                categoryAmount.textContent = `¥${formatNumber(amount)}`;

                categoryDiv.appendChild(categoryName);
                categoryDiv.appendChild(categoryAmount);

                budgetBreakdownElement.appendChild(categoryDiv);
            }
        }
    }

    function savePlan() {
        const tripName = document.getElementById('trip-name').value.trim();

        if (!tripName) {
            showToast("Please enter a trip name");
            return;
        }

        if (Object.keys(itineraryData).length === 0) {
            showToast("Please generate a plan first");
            return;
        }

        showToast("Plan saved successfully!");
    }

    function sharePlan() {
        if (Object.keys(itineraryData).length === 0) {
            showToast("Please generate a plan first");
            return;
        }

        showToast("Share link copied to clipboard!");
    }

    function formatNumber(num) {
        return num.toLocaleString('en-US');
    }

    function showToast(message) {
        toastMessage.textContent = message;
        toastMessage.classList.add('show');

        setTimeout(() => {
            toastMessage.classList.remove('show');
        }, 3000);
    }

    // URL parameter handling
    const urlParams = new URLSearchParams(window.location.search);
    const autoAddProvince = urlParams.get('province_id');

    if (autoAddProvince) {
        setTimeout(() => {
            provinceSelect.value = autoAddProvince;
            handleProvinceChange();
        }, 500);
    }
});