document.addEventListener('DOMContentLoaded', () => {
    // Legacy toggle logic removed in favor of initPasswordToggles()
    const loginBox = document.querySelector('.login-container');

    // Authentication Helper


    // Old demo handler removed

    // Navigation Logic (SPA)
    const navBtns = document.querySelectorAll('.nav-btn[data-section]');
    const sections = document.querySelectorAll('.content-section');

    if (navBtns.length > 0 && sections.length > 0) {
        navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-section');

                // Update Buttons
                navBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Update Sections
                sections.forEach(section => {
                    if (section.id === targetId) {
                        section.classList.remove('hidden');
                    } else {
                        section.classList.add('hidden');
                    }
                });
            });
        });
    }

    // Real Data Loading for Overview
    function loadUserStats(filter = 'all') {
        const failedEl = document.getElementById('stat-failed');
        if (!failedEl) return;

        if (!failedEl) return;

        fetch('/api/groups')
            .then(res => res.json())
            .then(groups => {
                let targetGroups = groups;
                let isTeacherView = !!document.getElementById('groupFilterDropdown');

                // 1. Determine Scope based on Filter
                if (filter !== 'all') {
                    // Specific Group selected (Teacher filter)
                    targetGroups = groups.filter(g => g.id == filter);
                } else {
                    // 'all' selected OR default load
                    // Check if Leader/Cell (No Overview Dropdown in Leader/Cell HTML)
                    if (!isTeacherView) {
                        // Leader/Cell View: Limit to their own group
                        const userGid = localStorage.getItem('userGid');
                        if (userGid) {
                            targetGroups = groups.filter(g => g.id == userGid);
                        } else {
                            // Fallback if no GID found but shouldn't happen for logged in users
                            // Maybe empty? Or All? Best to hide or show 0.
                            targetGroups = [];
                        }
                    }
                    // Teacher View with 'all' remains targetGroups = groups (all groups)
                }

                // 2. Aggregate Stats
                const total = targetGroups.reduce((acc, g) => ({
                    failed: acc.failed + (g.failed_count || 0),
                    completed: acc.completed + (g.completed_count || 0),
                    progress: acc.progress + (g.in_progress_count || 0),
                    score: acc.score + (g.score || 0)
                }), { failed: 0, completed: 0, progress: 0, score: 0 });

                // 3. Update DOM
                // Feature Request: Hide Score if "All Groups" selected (Teacher View)
                if (filter === 'all' && isTeacherView) {
                    total.score = '-';
                }

                failedEl.textContent = total.failed;
                document.getElementById('stat-completed').textContent = total.completed;
                document.getElementById('stat-progress').textContent = total.progress;
                document.getElementById('stat-score').textContent = total.score;
            })
            .catch(err => console.error('Error loading stats:', err));
    }

    // Data Loading for Team
    function loadTeamMembers(filter = 'all') {
        const listContainer = document.getElementById('memberList');
        if (!listContainer) return;

        listContainer.innerHTML = '<div style="text-align:center; padding:1rem;">Loading...</div>';

        listContainer.innerHTML = '<div style="text-align:center; padding:1rem;">Loading...</div>';

        fetch('/api/users')
            .then(res => res.json())
            .then(users => {
                let displayUsers = users;

                if (filter !== 'all') {
                    // Filter by param (Teacher Dropdown)
                    displayUsers = users.filter(u => u.gid == filter);
                } else {
                    // No explicit filter (argument is 'all')
                    // Check if we are in Leader/Cell view (No Filter Dropdown)
                    // If no dropdown, apply user's own group filter
                    const filterDropdown = document.getElementById('teamMemberFilterDropdown');
                    if (!filterDropdown) {
                        const userGid = localStorage.getItem('userGid');
                        if (userGid) {
                            displayUsers = users.filter(u => u.gid == userGid);
                        }
                    }
                }

                listContainer.innerHTML = ''; // Clear loading

                if (displayUsers.length === 0) {
                    listContainer.innerHTML = '<div style="text-align:center; padding:1rem; color: #888;">No members found.</div>';
                    return;
                }

                displayUsers.forEach(member => {
                    const item = document.createElement('div');
                    item.className = 'member-item';
                    item.innerHTML = `
                        <span class="member-name">${escapeHtml(member.name)}</span>
                        <span class="member-job">${escapeHtml(member.job || 'Member')}</span>
                        <span class="member-phone">${escapeHtml(member.phone || '-')}</span>
                    `;
                    listContainer.appendChild(item);
                });
            })
            .catch(err => {
                console.error('Error loading team members:', err);
                listContainer.innerHTML = '<div style="text-align:center; color: #ff4d4d;">Failed to load members.</div>';
            });
    }

    // Helper: Calculate Time Left
    function calculateTimeLeft(deadlineStr) {
        const deadline = new Date(deadlineStr);
        const now = new Date();
        const diff = deadline - now;

        if (diff <= 0) return "Expired";

        const months = Math.floor(diff / (1000 * 60 * 60 * 24 * 30));
        const days = Math.floor((diff % (1000 * 60 * 60 * 24 * 30)) / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        let result = "";
        if (months > 0) result += `${months}M `;
        if (days > 0) result += `${days}d `;
        if (hours > 0 || result === "") result += `${hours}h`;

        return result.trim();
    }

    // Helper: Format Date
    function formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString();
    }

    // Load Tasks (Supported Filter)
    function loadGroupTasks(filter = 'all') {
        const tbody = document.getElementById('tasksList');
        if (!tbody) return;

        // Determine effective filter for non-teachers
        const isTeacherView = !!document.getElementById('taskGroupFilterDropdown');
        let effectiveFilter = filter;

        if (!isTeacherView) {
            const userGid = localStorage.getItem('userGid');
            if (userGid) effectiveFilter = userGid;
            else effectiveFilter = 'all'; // Fallback
        }

        fetch(`/api/tasks?gid=${effectiveFilter}`)
            .then(res => res.json())
            .then(tasks => {
                tbody.innerHTML = '';

                // Client-side status/deadline filtering if needed (mirroring old mock logic)
                // Filter by Status (Only In-Progress)
                let displayTasks = tasks.filter(t => t.status === 'in-progress');

                // Filter by Expiration (Not Expired)
                const now = new Date();
                displayTasks = displayTasks.filter(t => new Date(t.deadline) > now);

                if (displayTasks.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;">No task for now</td></tr>';
                    return;
                }

                displayTasks.forEach(task => {
                    const tr = document.createElement('tr');

                    // Truncate Description logic
                    const desc = task.description.length > 50 ? task.description.substring(0, 50) + '...' : task.description;
                    const timeLeft = calculateTimeLeft(task.deadline);
                    const startDate = formatDate(task.createdAt);

                    tr.innerHTML = `
                        <td><span class="critic-dot critic-${task.criticality}"></span></td>
                        <td>${task.title}</td>
                        <td>
                            <div class="task-desc truncate" title="${task.description}">${task.description}</div>
                        </td>
                        <td>${startDate}</td>
                        <td>${timeLeft}</td>
                        <td>
                            <button class="btn-expand">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            })
            .catch(err => {
                console.error('Error loading tasks:', err);
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: red;">Failed to load tasks</td></tr>';
            });
    }

    // Load System Tasks (Manage Task Box - Teacher View)
    function loadSystemTasks() {
        const tbody = document.getElementById('systemTasksList');
        if (!tbody) return;

        const userRole = localStorage.getItem('userRole');
        const userGid = localStorage.getItem('userGid');
        let fetchUrl = '/api/tasks?gid=all';

        if (userRole === 'LEADER' && userGid) {
            fetchUrl = `/api/tasks?gid=${userGid}`;
        }

        fetch(fetchUrl)
            .then(res => res.json())
            .then(tasks => {
                renderSystemTasks(tasks, tbody);
            })
            .catch(err => {
                console.error('Error loading system tasks:', err);
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: red;">Failed to load system tasks</td></tr>';
            });
    }
    // Helper: Escape HTML to prevent XSS
    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Expose to window for global access
    window.loadSystemTasks = loadSystemTasks;
    window.escapeHtml = escapeHtml;

    // Helper to initialize custom selects
    function initCustomSelect(selector, callback) {
        const customSelect = document.getElementById(selector);
        if (customSelect) {
            const trigger = customSelect.querySelector('.select-trigger');
            const options = customSelect.querySelectorAll('.option');
            const selectedText = customSelect.querySelector('.selected-text');

            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                // Close others if needed, or just toggle self
                document.querySelectorAll('.custom-select.open').forEach(s => {
                    if (s !== customSelect) s.classList.remove('open');
                });
                customSelect.classList.toggle('open');
            });

            options.forEach(option => {
                option.addEventListener('click', (e) => {
                    e.stopPropagation();
                    options.forEach(opt => opt.classList.remove('selected'));
                    option.classList.add('selected');
                    selectedText.textContent = option.textContent;
                    customSelect.classList.remove('open');

                    const value = option.getAttribute('data-value');
                    callback(value);
                });
            });

            document.addEventListener('click', (e) => {
                if (!customSelect.contains(e.target)) {
                    customSelect.classList.remove('open');
                }
            });
        }
    }

    // --- Filter Panel Logic ---

    // 1. Toggle Panel
    const filterPanel = document.getElementById('filterPanel');
    const filterBtn = document.getElementById('filterTasksBtn');
    const closeFilterBtn = document.getElementById('closeFilterPanel');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');

    if (filterBtn && filterPanel) {
        filterBtn.addEventListener('click', () => {
            filterPanel.classList.add('open');
            populateGroupFilterOptions(); // Load groups when opening
        });
    }

    if (closeFilterBtn && filterPanel) {
        closeFilterBtn.addEventListener('click', () => {
            filterPanel.classList.remove('open');
        });
    }

    // 2. Populate Group Options
    function populateGroupFilterOptions() {
        const container = document.getElementById('groupFilterOptions');
        if (!container || container.children.length > 0) return; // Prevent duplicate loading

        if (!container || container.children.length > 0) return; // Prevent duplicate loading

        fetch('/api/groups')
            .then(res => res.json())
            .then(groups => {
                container.innerHTML = '';
                groups.forEach(group => {
                    const label = document.createElement('label');
                    label.classList.add('checkbox-item');
                    label.innerHTML = `
                        <input type="checkbox" value="${group.id}" name="group">
                        <span class="custom-checkbox"></span>
                        ${escapeHtml(group.name)}
                    `;
                    container.appendChild(label);
                });
            })
            .catch(err => console.error('Error loading groups for filter:', err));
    }

    // 3. Apply Filters
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            applySystemTaskFilters();
            if (filterPanel) filterPanel.classList.remove('open');
        });
    }

    // 4. Reset Filters
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            // Clear all inputs
            document.querySelectorAll('#filterPanel input[type="checkbox"]').forEach(cb => cb.checked = false);
            document.querySelectorAll('#filterPanel input[type="date"]').forEach(i => i.value = '');
            loadSystemTasks(); // Reload all
            if (filterPanel) filterPanel.classList.remove('open');
        });
    }

    // Core Filter Function for System Tasks
    function applySystemTaskFilters() {
        const tbody = document.getElementById('systemTasksList');
        if (!tbody) return;

        // Get Values
        const selectedGroups = Array.from(document.querySelectorAll('input[name="group"]:checked')).map(cb => cb.value);
        const selectedCriticality = Array.from(document.querySelectorAll('input[name="criticality"]:checked')).map(cb => cb.value);
        const selectedStatus = Array.from(document.querySelectorAll('input[name="status"]:checked')).map(cb => cb.value);
        const startDate = document.getElementById('filterStartDate').value;
        const endDate = document.getElementById('filterEndDate').value;

        // Determine Fetch URL logic (Mirroring loadSystemTasks)
        const userRole = localStorage.getItem('userRole');
        const userGid = localStorage.getItem('userGid');
        let fetchUrl = '/api/tasks?gid=all';

        if (userRole === 'LEADER' && userGid) {
            fetchUrl = `/api/tasks?gid=${userGid}`;
        }

        // Fetch tasks then filter (Client-side)
        // Fetch tasks then filter (Client-side)
        fetch(fetchUrl)
            .then(res => res.json())
            .then(tasks => {
                let filtered = tasks;

                // 1. Group Filter
                if (selectedGroups.length > 0) {
                    filtered = filtered.filter(t => selectedGroups.includes(String(t.group)));
                }

                // 2. Criticality Filter
                if (selectedCriticality.length > 0) {
                    filtered = filtered.filter(t => selectedCriticality.includes(t.criticality));
                }

                // 3. Status Filter
                if (selectedStatus.length > 0) {
                    filtered = filtered.filter(t => selectedStatus.includes(t.status));
                }

                // 4. Date Range Filter
                if (startDate) {
                    filtered = filtered.filter(t => new Date(t.createdAt) >= new Date(startDate));
                }
                if (endDate) {
                    filtered = filtered.filter(t => new Date(t.deadline) <= new Date(endDate));
                }

                // Render Filtered Results
                renderSystemTasks(filtered, tbody);
            })
            .catch(err => {
                console.error('Filtering error:', err);
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: red;">Error applying filters</td></tr>';
            });
    }

    // Extracted Render Logic for Reusability
    // Extracted Render Logic for Reusability
    function renderSystemTasks(tasks, tbody) {
        tbody.innerHTML = '';

        if (tasks.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;">No system tasks match your filter</td></tr>';
            return;
        }

        const userRole = localStorage.getItem('userRole'); // Get current role
        const userGid = localStorage.getItem('userGid'); // Get current User GID

        tasks.forEach(task => {
            const cleanStatus = task.status || 'NOT_STARTED';
            // Hide Completed and Failed Tasks for Leaders
            if (userRole === 'LEADER' && (cleanStatus === 'completed' || cleanStatus === 'failed')) return;

            const tr = document.createElement('tr');
            const desc = task.description.length > 50 ? task.description.substring(0, 50) + '...' : task.description;
            const timeLeft = calculateTimeLeft(task.deadline !== 'N/A' ? task.deadline : null);
            const startDate = formatDate(task.createdAt);

            const displayStatus = task.status ? task.status.replace(/_/g, ' ') : 'Not Started';

            // Action Column Logic
            let actionButtons = '';
            if (userRole === 'TEACHER') {
                actionButtons = `
                <button class="btn-creative-edit edit-task-btn" title="Edit Task" data-id="${task.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="btn-creative-delete delete-task-btn" title="Delete Task" data-id="${task.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            `;
            } else if (userRole === 'LEADER' && (task.group == userGid)) {
                if (cleanStatus === 'NOT_STARTED') {
                    actionButtons = `
                    <button class="action-btn success-btn task-action-btn" data-id="${task.id}" data-status="in-progress" title="Start Task">
                        Start
                    </button>
                `;
                } else if (cleanStatus === 'in-progress') {
                    actionButtons = `
                    <button class="action-btn success-btn task-action-btn" data-id="${task.id}" data-status="completed" title="Complete Task" style="margin-right: 5px;">
                        Complete
                    </button>
                    <button class="action-btn danger-btn task-action-btn" data-id="${task.id}" data-status="failed" title="Fail Task">
                        Failed
                    </button>
                `;
                } else {
                    actionButtons = `<span class="status-text">${displayStatus}</span>`;
                }
            }

            tr.innerHTML = `
            <td><span class="critic-dot critic-${escapeHtml(task.criticality)}"></span></td>
            <td>${escapeHtml(task.title)}</td>
            <td>
                <div class="task-desc truncate" title="${escapeHtml(task.description)}">${escapeHtml(task.description)}</div>
            </td>
            <td>${escapeHtml(task.maker_name || 'System')}</td>
            <td>
                <span class="status-badge status-${cleanStatus}">
                   ${cleanStatus.replace(/-/g, ' ').toUpperCase()}
                </span>
            </td>
            <td>${startDate}</td>
            <td>${timeLeft}</td>
            <td>
                <div class="action-buttons">
                    ${actionButtons}
                </div>
            </td>
            <td>
                <button class="btn-expand">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
            </td>
        `;
            tbody.appendChild(tr);
        });
    }

    // Global function for Leader Status Update
    window.updateTaskStatus = function (taskId, newStatus) {
        // Legacy redundant token fetch removed since authenticatedFetch handles it
        // But we keep manual fetch here if we want or refactor. 
        // Let's refactor to be consistent.
        fetch(`/api/tasks/${taskId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({ status: newStatus })
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    showNotification('Success', 'Task status updated.', 'success');
                    window.loadSystemTasks(); // Refresh list
                } else {
                    showNotification('Error', data.message || 'Update failed.', 'error');
                }
            })
            .catch(err => {
                console.error('Status Error:', err);
                showNotification('Error', 'An unexpected error occurred.', 'error');
            });
    };

    // Initialize Filters
    initCustomSelect('groupFilterDropdown', (value) => {
        loadUserStats(value);
    });

    initCustomSelect('taskGroupFilterDropdown', (value) => {
        loadGroupTasks(value);
    });

    /* 
    // Old Native Filter Logic Removed
    const groupFilter = document.getElementById('groupFilter');
    if (groupFilter) {
        groupFilter.addEventListener('change', (e) => {
            loadUserStats(e.target.value);
        });
    }
    */

    // Event Delegation for Task Toggling
    // Unified Event Delegation for Task Toggling (All Tables)
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-expand');
        if (!btn) return;

        const row = btn.closest('tr');
        if (!row) return;

        // Ensure we are inside a tasks table
        if (!row.closest('.tasks-table')) return;

        const descDiv = row.querySelector('.task-desc');
        const icon = btn.querySelector('svg');
        const isExpanded = row.classList.contains('expanded');

        // Close all other rows in THIS specific table
        const table = row.closest('table');
        if (table) {
            table.querySelectorAll('tr.expanded').forEach(r => {
                if (r !== row) {
                    r.classList.remove('expanded');
                    const d = r.querySelector('.task-desc');
                    if (d) d.classList.add('truncate');
                    const i = r.querySelector('.btn-expand svg');
                    if (i) i.style.transform = 'rotate(0deg)';
                }
            });
        }

        if (!isExpanded) {
            // Expand this row
            row.classList.add('expanded');
            if (descDiv) descDiv.classList.remove('truncate');
            if (icon) icon.style.transform = 'rotate(180deg)';
        } else {
            // Collapse this row
            row.classList.remove('expanded');
            if (descDiv) descDiv.classList.add('truncate');
            if (icon) icon.style.transform = 'rotate(0deg)';
        }
    });

    // Delegation for Leader Task Actions (Start/Complete/Fail)
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.task-action-btn');
        if (!btn) return;

        const taskId = btn.getAttribute('data-id');
        const status = btn.getAttribute('data-status');

        if (taskId && status && typeof window.updateTaskStatus === 'function') {
            window.updateTaskStatus(taskId, status);
        }
    });

    /* 
    // Old Native Filter Logic Listener (Removed)
    const groupFilter = document.getElementById('groupFilter');
    if (groupFilter) {
        groupFilter.addEventListener('change', (e) => {
            loadUserStats(e.target.value);
        });
    }
    */

    // Load User Tasks for Status Page (filtered by GID or selection)
    function loadStatusPageTasks(filter = 'group1') { // Default to 'group1' simulation for user (overridden by auth logic)
        const tbody = document.getElementById('statusPageTasksList');
        if (!tbody) return;

        // Determine effective filter for non-teachers
        const isTeacherView = !!document.getElementById('statusGroupFilterDropdown');
        let effectiveFilter = filter;

        if (!isTeacherView) {
            const userGid = localStorage.getItem('userGid');
            if (userGid) effectiveFilter = userGid;
            else effectiveFilter = 'all';
        }

        // If Teacher View defaults to 'all' but initial call might be 'group1' (from old code comments). 
        // We should respect the passed filter if valid, else default.
        // But for Teacher, we usually default to 'all'.
        if (isTeacherView && filter === 'group1') effectiveFilter = 'all'; // Reset default mock

        fetch(`/api/tasks?gid=${effectiveFilter}`)
            .then(res => res.json())
            .then(userTasks => {
                tbody.innerHTML = '';

                if (userTasks.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 2rem;">No task for now</td></tr>';
                    return;
                }

                userTasks.forEach(task => {
                    const tr = document.createElement('tr');

                    // Truncate Description logic
                    const desc = task.description.length > 50 ? task.description.substring(0, 50) + '...' : task.description;
                    const timeLeft = calculateTimeLeft(task.deadline);
                    const startDate = formatDate(task.createdAt);

                    // Add Status Column
                    tr.innerHTML = `
                        <td><span class="critic-dot critic-${escapeHtml(task.criticality)}"></span></td>
                        <td>${escapeHtml(task.title)}</td>
                        <td>
                            <div class="task-desc truncate" title="${escapeHtml(task.description)}">${escapeHtml(task.description)}</div>
                        </td>
                        <td><span class="status-badge status-${escapeHtml(task.status)}">${escapeHtml(task.status)}</span></td>
                        <td>${startDate}</td>
                        <td>${timeLeft}</td>
                        <td>
                            <button class="btn-expand">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            })
            .catch(err => {
                console.error('Error loading status tasks:', err);
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: red;">Failed to load tasks</td></tr>';
            });
    }

    // Load Managed Users (Teachers see all, filterable)
    function loadManagedUsers(filter = 'all') {
        const tbody = document.getElementById('managedUsersList');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;">Loading users...</td></tr>';

        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;">Loading users...</td></tr>';

        fetch('/api/users')
            .then(response => response.json())
            .then(users => {
                let displayUsers = users;

                if (filter !== 'all') {
                    // Filter by Group ID (gid)
                    // Ensure type coercion (string from dropdown vs number from DB)
                    displayUsers = users.filter(user => user.gid == filter);
                }

                tbody.innerHTML = '';

                if (displayUsers.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;">No users found for this filter.</td></tr>';
                    return;
                }

                displayUsers.forEach(u => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                    <td>${escapeHtml(u.name)}</td>
                    <td><span class="badge badge-job">${escapeHtml(u.job || 'N/A')}</span></td>
                    <td>${escapeHtml(u.phone || '-')}</td>
                    <td>${escapeHtml(u.email)}</td>
                    <td><span class="status-badge ${u.role === 'LEADER' ? 'role-leader' : 'role-member'}">${escapeHtml(u.role)}</span></td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn edit-btn" title="Edit User" 
                                data-id="${u.id}" 
                                data-name="${escapeHtml(u.name)}"
                                data-email="${escapeHtml(u.email)}"
                                data-job="${escapeHtml(u.job || '')}"
                                data-role="${escapeHtml(u.role)}"
                                data-gid="${u.gid || ''}">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            <button class="action-btn delete-btn" title="Delete User" data-id="${u.id}" data-name="${escapeHtml(u.name)}">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                        </div>
                    </td>
                `;
                    tbody.appendChild(tr);
                });
            })
            .catch(err => {
                console.error('Error loading users:', err);
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: red; padding: 2rem;">Failed to load users.</td></tr>';
            });
    }
    // Expose to window
    window.loadManagedUsers = loadManagedUsers;

    // Dummy Action Handlers
    window.editUser = function (id) {
        showNotification('Info', `Edit user ${id} (Not implemented)`, 'success');
    };

    // Initialize Filters with Real Groups
    loadGroupsIntoDropdown('groupFilterDropdown', (val) => loadUserStats(val));
    loadGroupsIntoDropdown('teamMemberFilterDropdown', (val) => loadTeamMembers(val));
    loadGroupsIntoDropdown('taskGroupFilterDropdown', (val) => loadGroupTasks(val));
    loadGroupsIntoDropdown('statusGroupFilterDropdown', (val) => loadStatusPageTasks(val));
    loadGroupsIntoDropdown('teamsGroupFilterDropdown', (val) => loadManagedUsers(val));

    // Add Member Modal Group Select (No "All" option)
    const addMemberGroupSelect = document.getElementById('addMemberGroupSelect');
    if (addMemberGroupSelect) {
        // This is a custom select or native? Based on HTML inspection (not fully visible), 
        // usually custom selects in this app follow the pattern. 
        // If it's a custom select reused structure:
        loadGroupsIntoDropdown('addMemberGroupSelect', (val) => {
            addMemberGroupSelect.dataset.selectedId = val;
        }, false);
    }

    // Initialize Teams Filter (Teacher) - Dynamic
    // loadGroupsIntoDropdown calls bindCustomSelectLogic internally
    if (typeof loadGroupsIntoDropdown === 'function') {
        loadGroupsIntoDropdown('teamsGroupFilterDropdown', (value) => {
            loadManagedUsers(value);
        });
    } else {
        // Fallback or wait? Global function should be hoisted or available if defined at end?
        // JS Functions defined at bottom are hoisted ONLY if function declarations.
        // My append will be function declarations.
        // But this call is inside DOMContentLoaded. The append is outside.
        // Code inside DOMContentLoaded runs AFTER script parsing.
        // So global functions defined at bottom WILL be available.
        loadGroupsIntoDropdown('teamsGroupFilterDropdown', (value) => {
            loadManagedUsers(value);
        });
    }

    // Initial Load
    loadUserStats();

    // Initialize Team Member Filter (Leader) and Load
    if (document.getElementById('teamMemberFilterDropdown')) {
        loadGroupsIntoDropdown('teamMemberFilterDropdown', (value) => {
            loadTeamMembers(value);
        });
    }
    loadTeamMembers();

    loadGroupTasks();

    // Initial Status Page Load (Context Sensitive)
    if (document.getElementById('statusGroupFilterDropdown')) {
        loadStatusPageTasks('all'); // Teacher defaults to All
    } else {
        loadStatusPageTasks('group1'); // Leader/Cell defaults to own group
    }

    // Initial Managed Users Load
    loadManagedUsers();

    // Initial System Tasks Load (Teacher Manage Task Box)
    loadSystemTasks();

    // Initial Leaderboard Load
    loadLeaderboard();

    // Initial Profile Load
    loadUserProfile();
    initProfileSettings();

    // Initialize Status Page Filter (Teacher)
    initCustomSelect('statusGroupFilterDropdown', (value) => {
        loadStatusPageTasks(value);
    });



    // Email Input Validation: Restrict strict symbols (allow only alphanumeric, ., -, _, @)
    const emailInput = document.getElementById('email');
    if (emailInput) {
        emailInput.addEventListener('input', (e) => {
            // Regex: Allow letters, numbers, ., -, _, and @. Remove everything else.
            e.target.value = e.target.value.replace(/[^a-zA-Z0-9.@_-]/g, '');
        });
    }

    // Login Form Submission
    const loginForm = document.querySelector('form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const submitBtn = loginForm.querySelector('button[type="submit"]');

            try {
                // Clear previous errors
                const errorDiv = document.getElementById('loginError');
                if (errorDiv) errorDiv.classList.add('hidden');

                // Disable button and show loading state if you had one (optional refinement)
                submitBtn.disabled = true;
                submitBtn.innerText = 'Signing In...';

                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (data.success) {
                    // Save Token
                    localStorage.setItem('authToken', data.token); // Save JWT
                    localStorage.setItem('userRole', data.role); // Save Role for UI checks
                    if (data.gid) localStorage.setItem('userGid', data.gid); // Save Group ID

                    // Proceed with login...
                    // Login Animation
                    if (loginBox) { // Check if loginBox exists before animating
                        loginBox.style.transform = 'scale(0.9)';
                        loginBox.style.opacity = '0';
                    }

                    // Redirect based on role
                    if (data.role === 'TEACHER') {
                        window.location.href = '/teacher.html';
                    } else if (data.role === 'LEADER') {
                        window.location.href = '/leader.html';
                    } else {
                        window.location.href = '/cell.html';
                    }
                } else {
                    // Show Error in Box
                    const errorDiv = document.getElementById('loginError');
                    if (errorDiv) {
                        errorDiv.textContent = data.message || 'Invalid email or password.';
                        errorDiv.classList.remove('hidden');

                        // Shake Animation Reset
                        errorDiv.style.animation = 'none';
                        errorDiv.offsetHeight; /* trigger reflow */
                        errorDiv.style.animation = null;
                    } else {
                        // Fallback
                        alert('Login Failed: ' + data.message);
                    }
                }
            } catch (error) {
                console.error('Login Error:', error);
                alert('An error occurred during login: ' + error.message);
            } finally {
                submitBtn.disabled = false;
                // Check current language to reset button text correctly
                const isFrench = document.documentElement.lang === 'fr';
                submitBtn.innerText = isFrench ? 'Se connecter' : 'Sign In';
            }
        });
    }

    // Attach event listener for Delete Group button
    const openDeleteGroupBtn = document.getElementById('openDeleteGroupBtn');
    if (openDeleteGroupBtn) {
        openDeleteGroupBtn.addEventListener('click', openDeleteGroupModal);
    }

    const closeDeleteGroupBtn = document.getElementById('closeDeleteGroupBtn');
    if (closeDeleteGroupBtn) {
        closeDeleteGroupBtn.addEventListener('click', closeDeleteGroupModal);
    }
});

// Delete Group Modal Logic
let selectedGroupsToDelete = new Set(); // Changed from single value to Set

function openDeleteGroupModal() {
    const modal = document.getElementById('deleteGroupModal');
    const listContainer = document.getElementById('deleteGroupList');
    const confirmBtn = document.getElementById('confirmDeleteGroupBtn');

    // Reset State
    selectedGroupsToDelete.clear();
    confirmBtn.disabled = true;
    confirmBtn.innerText = 'Confirm Delete';
    listContainer.innerHTML = '<p style="text-align: center; color: #888; padding: 1rem;">Loading groups...</p>';

    if (modal) modal.classList.add('visible');

    // Fetch Groups from API
    fetch('/api/groups')
        .then(response => response.json())
        .then(groups => {
            listContainer.innerHTML = ''; // Clear loading

            if (groups.length === 0) {
                listContainer.innerHTML = '<p style="text-align: center; color: #888; padding: 1rem;">No groups found.</p>';
                return;
            }

            groups.forEach(group => {
                const item = document.createElement('div');
                item.className = 'group-option';
                item.onclick = () => toggleGroupSelection(group.id, item); // Changed to toggle
                item.innerHTML = `
                    <div class="group-info">
                        <h3>${escapeHtml(group.name)}</h3>
                        <span>${escapeHtml(group.count)} Members</span>
                    </div>
                    <div class="radio-indicator"></div>
                `;
                listContainer.appendChild(item);
            });
        })
        .catch(err => {
            console.error('Error fetching groups:', err);
            listContainer.innerHTML = '<p style="text-align: center; color: #dc3545; padding: 1rem;">Failed to load groups.</p>';
        });
}

function closeDeleteGroupModal() {
    const modal = document.getElementById('deleteGroupModal');
    if (modal) modal.classList.remove('visible');
}

function toggleGroupSelection(groupId, element) {
    if (selectedGroupsToDelete.has(groupId)) {
        selectedGroupsToDelete.delete(groupId);
        element.classList.remove('selected');
    } else {
        selectedGroupsToDelete.add(groupId);
        element.classList.add('selected');
    }

    // DEBUG: Confirm logic is running
    console.log(`Selection logic running. Size: ${selectedGroupsToDelete.size}`);

    const confirmBtn = document.getElementById('confirmDeleteGroupBtn');
    if (selectedGroupsToDelete.size > 0) {
        confirmBtn.disabled = false;
        confirmBtn.innerText = `Delete ${selectedGroupsToDelete.size} Group(s)`;
    } else {
        confirmBtn.disabled = true;
        confirmBtn.innerText = 'Confirm Delete';
    }
}

// Confirm Delete Action
function confirmDeleteGroup() {
    // DEBUG: Confirm button clicked
    console.log('Confirm Delete Button Clicked');

    const confirmBtn = document.getElementById('confirmDeleteGroupBtn');

    if (selectedGroupsToDelete.size > 0) {
        confirmBtn.disabled = true;
        confirmBtn.innerText = 'Deleting...';

        const token = localStorage.getItem('authToken'); // Get Token
        const groupsToDeleteArray = Array.from(selectedGroupsToDelete);

        fetch('/api/groups/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ groupIds: groupsToDeleteArray })
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showNotification('Success', data.message, 'success');
                    // Wait for user to read message
                    setTimeout(() => {
                        closeDeleteGroupModal();
                        // window.location.reload(); // REMOVED

                        // Refresh the delete list in case we open it again (optional, dependent on implementation)
                        // But modal closes, so it's fine.
                    }, 1000);
                } else {
                    showNotification('Delete Failed', data.message || 'Failed to delete groups.', 'error');
                    confirmBtn.disabled = false;
                    confirmBtn.innerText = 'Retry Delete';
                    // Modal stays open
                }
            })
            .catch(error => {
                console.error('Delete Error:', error);
                showNotification('System Error', 'An error occurred while deleting groups.', 'error');
                confirmBtn.disabled = false;
                confirmBtn.innerText = 'Retry Delete';
            });
    }
}

// --- Create Group Modal Logic ---
// --- Create Group Modal Logic ---
// We query elements inside functions to ensure they exist when called
function openCreateGroupModal() {
    console.log('Attempting to open Create Group Modal...'); // DEBUG
    const modal = document.getElementById('createGroupModal');
    if (modal) {
        modal.classList.remove('hidden');
        // Small delay to allow display:flex to apply before opacity transition
        requestAnimationFrame(() => {
            modal.classList.add('visible');
        });
        console.log('Modal opened.');
    } else {
        console.error('Create Group Modal (ID: createGroupModal) not found in DOM!');
        alert('Error: Modal element not found.');
    }
}

const newGroupNamesInput = document.getElementById('newGroupNames');

function closeCreateGroupModal() {
    const modal = document.getElementById('createGroupModal');
    if (modal) {
        modal.classList.remove('visible');
        setTimeout(() => {
            modal.classList.add('hidden');
            if (newGroupNamesInput) newGroupNamesInput.value = ''; // Reset
        }, 300);
    }
}

// Attach Close Listener (Safe)
document.addEventListener('DOMContentLoaded', () => {
    const closeCreateBtn = document.getElementById('closeCreateGroupBtn');
    if (closeCreateBtn) {
        closeCreateBtn.addEventListener('click', closeCreateGroupModal);
    }
});

// --- Premium Notification Logic ---
function showNotification(title, message, type = 'success') {
    // Remove existing notification if any
    const existing = document.querySelector('.premium-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `premium-notification ${type}`;

    const icon = type === 'success' ?
        `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>` :
        `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

    notification.innerHTML = `
        <div class="icon">${icon}</div>
        <div class="content">
            <div class="title">${title}</div>
            <div class="message">${message}</div>
        </div>
    `;

    document.body.appendChild(notification);

    // Trigger animation
    requestAnimationFrame(() => {
        notification.classList.add('visible');
    });

    // Auto remove
    setTimeout(() => {
        notification.classList.remove('visible');
        setTimeout(() => notification.remove(), 400);
    }, 4000);
}

// Create Group Handler
async function batchCreateGroups() {
    const rawNames = newGroupNamesInput.value;
    if (!rawNames.trim()) {
        showNotification('Validation Error', 'Please enter at least one group name.', 'error');
        return;
    }

    // Split by comma or newline, trim, and filter empty
    const names = rawNames.split(/[\n,]+/).map(n => n.trim()).filter(n => n.length > 0);

    if (names.length === 0) {
        showNotification('Validation Error', 'No valid group names found.', 'error');
        return;
    }

    const confirmBtn = document.getElementById('confirmCreateGroupBtn');
    confirmBtn.disabled = true;
    confirmBtn.innerText = 'Creating...';

    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch('/api/groups/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ groupNames: names })
        });

        const data = await response.json();



        if (response.ok && data.success) {
            showNotification('Success', data.message, 'success');

            // Wait for user to read message before closing
            setTimeout(() => {
                closeCreateGroupModal();
                // window.location.reload(); // REMOVED to prevent redirecting to home

                // Optionally refresh data here if we had dynamic dropdowns
                // loadGroupDropdowns(); 
            }, 1000);

        } else {
            showNotification('Creation Failed', data.message || 'Failed to create groups.', 'error');
            // Do NOT close modal on error, allowing user to retry
        }

    } catch (error) {
        console.error('Create Group Error:', error);
        showNotification('System Error', 'An unexpected error occurred.', 'error');
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerText = 'Create Groups';
    }
}

// Expose functions to window
window.openDeleteGroupModal = openDeleteGroupModal;
window.closeDeleteGroupModal = closeDeleteGroupModal;
window.toggleGroupSelection = toggleGroupSelection; // Changed name
window.confirmDeleteGroup = confirmDeleteGroup;
// Create Group Exposures
window.openCreateGroupModal = openCreateGroupModal;
window.closeCreateGroupModal = closeCreateGroupModal;
window.batchCreateGroups = batchCreateGroups;

// Logout Function
function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userGid'); // Clear GID too
    window.location.href = '/index.html';
}

window.logout = logout;

// Attach Event Listener when DOM is ready (Safe fallback)
document.addEventListener('DOMContentLoaded', () => {
    // Confirm Delete Button Logic
    const confirmBtn = document.getElementById('confirmDeleteGroupBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', confirmDeleteGroup);
        console.log('Confirm Delete Listener Attached');
    }

    // Confirm Create Button Logic
    const createBtn = document.getElementById('confirmCreateGroupBtn');
    if (createBtn) {
        createBtn.addEventListener('click', batchCreateGroups);
        console.log('Create Group Listener Attached');
    }

    // Open Create Modal Logic
    const openCreateBtn = document.getElementById('openCreateGroupBtn');
    if (openCreateBtn) {
        openCreateBtn.addEventListener('click', openCreateGroupModal);
        console.log('Open Create Modal Listener Attached');
    }

    // Logout Button Logic
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            console.log('Logout Clicked'); // DEBUG
            logout();
        });
        console.log('Logout Listener Attached');
    }
});

// --- Add Member Modal Logic (Global) ---
function openAddMemberModal() {
    console.log('Opening Add Member Modal...');

    // 1. Open UI immediately
    const modal = document.getElementById('addMemberModal');
    if (modal) {
        modal.classList.add('visible');
    } else {
        console.error('Add Member Modal ID not found in DOM');
        return;
    }

    // 2. Load Data asynchronously
    loadGroupsIntoDropdown('addMemberGroupSelect', (val) => {
        console.log('Selected Group for Member:', val);
        const select = document.getElementById('addMemberGroupSelect');
        if (select) select.setAttribute('data-selected-id', val);
    }, false); // False = No "All Groups" option

    // Initialize Role Dropdown (Static)
    const roleSelect = document.getElementById('addMemberRoleSelect');
    if (roleSelect) {
        // Ensure default selection visual
        const selected = roleSelect.querySelector('.option.selected');
        if (selected) {
            roleSelect.querySelector('.selected-text').textContent = selected.textContent;
        }
        bindCustomSelectLogic(roleSelect, (val) => {
            console.log('Selected Role:', val);
        });
    }
}

function closeAddMemberModal() {
    const modal = document.getElementById('addMemberModal');
    if (modal) {
        modal.classList.remove('visible');
        setTimeout(() => {
            // Reset Fields
            const nameInput = document.getElementById('addMemberName');
            if (nameInput) nameInput.value = '';
            const emailInput = document.getElementById('addMemberEmail');
            if (emailInput) emailInput.value = '';
            const jobInput = document.getElementById('addMemberJob');
            if (jobInput) jobInput.value = '';
        }, 300);
    }
}

// --- Edit User Logic ---
let userToEditId = null;

function openEditUserModal(data) {
    userToEditId = data.id;
    const modal = document.getElementById('editUserModal');

    // Pre-fill inputs
    document.getElementById('editMemberName').value = data.name;
    document.getElementById('editMemberEmail').value = data.email;
    document.getElementById('editMemberJob').value = data.job;

    // Pre-select Group (Reuse loadGroupsIntoDropdown logic or just select if loaded)
    // For simplicity, we trigger a fresh load matching the logic of Add Member, then select
    const groupSelect = document.getElementById('editMemberGroupSelect');
    if (groupSelect) {
        // Set data attribute which our select logic uses to show selected state
        groupSelect.setAttribute('data-selected-id', data.gid);

        // Note: Ideally we call loadGroupsIntoDropdown here to ensure options exist. 
        // We'll reuse the existing function but target this specific ID.
        loadGroupsIntoDropdown('editMemberGroupSelect', (val) => {
            groupSelect.setAttribute('data-selected-id', val);
        }, false);

        // Update visual text if possible (Generic approach)
        // If options are already loaded, we update Immediately. 
        // But loadGroupsIntoDropdown is async. The callback handles the selection update.
    }

    // Pre-select Role
    const roleSelect = document.getElementById('editMemberRoleSelect');
    if (roleSelect) {
        // Reset selection
        const options = roleSelect.querySelectorAll('.option');
        options.forEach(opt => {
            opt.classList.remove('selected');
            if (opt.dataset.value === data.role) {
                opt.classList.add('selected');
                roleSelect.querySelector('.selected-text').textContent = opt.textContent;
            }
        });
        bindCustomSelectLogic(roleSelect, () => { }); // Re-bind to ensure click works
    }

    if (modal) {
        modal.classList.remove('hidden');
        requestAnimationFrame(() => modal.classList.add('visible'));
    }
}

function closeEditUserModal() {
    userToEditId = null;
    const modal = document.getElementById('editUserModal');
    if (modal) {
        modal.classList.remove('visible');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
}

async function confirmEditUser() {
    if (!userToEditId) return;

    const name = document.getElementById('editMemberName').value;
    const email = document.getElementById('editMemberEmail').value;
    const job = document.getElementById('editMemberJob').value;
    const groupSelect = document.getElementById('editMemberGroupSelect');
    const gid = groupSelect ? groupSelect.getAttribute('data-selected-id') : null;
    const roleSelect = document.getElementById('editMemberRoleSelect');
    const role = roleSelect ? (roleSelect.querySelector('.option.selected')?.dataset.value || 'NORMAL') : 'NORMAL';

    // Validation (Mirrors Add)
    if (!name || !email) {
        showNotification('Validation Error', 'Name and Email are required.', 'error');
        return;
    }
    if (!gid || gid === 'all') { // If they unselect or something
        // Optional: Allow NULL group? Logic implies gid is required usually or null for non-assigned. 
        // Let's enforce selection if it was there.
    }

    const confirmBtn = document.getElementById('confirmEditMemberBtn');
    confirmBtn.disabled = true;
    confirmBtn.innerText = 'Saving...';

    const token = localStorage.getItem('authToken');

    try {
        const response = await fetch(`/api/users/${userToEditId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ fullName: name, email, job, gid, role })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showNotification('Success', data.message, 'success');
            setTimeout(() => {
                closeEditUserModal();
                const currentFilter = document.querySelector('#teamsGroupFilterDropdown .selected-text').textContent;
                const filterVal = currentFilter === 'All Groups' ? 'all' : document.querySelector('#teamsGroupFilterDropdown .option.selected')?.dataset.value || 'all';
                loadManagedUsers(filterVal);
            }, 500);
        } else {
            showNotification('Error', data.message || 'Failed to update user.', 'error');
            confirmBtn.disabled = false;
            confirmBtn.innerText = 'Save Changes';
        }
    } catch (error) {
        console.error("Edit User Error:", error);
        showNotification('Error', 'An unexpected error occurred.', 'error');
        confirmBtn.disabled = false;
        confirmBtn.innerText = 'Save Changes';
    }
}

// Expose openEdit if needed, but delegation preferred
window.openEditUserModal = openEditUserModal;

// --- Delete User Logic ---
let userToDeleteId = null;

function openDeleteUserModal(id, name) {
    userToDeleteId = id;
    const modal = document.getElementById('deleteUserModal');
    const msg = document.getElementById('deleteUserMessage');
    const confirmBtn = document.getElementById('confirmDeleteUserBtn');

    if (modal) {
        if (msg) msg.textContent = `Are you sure you want to delete ${escapeHtml(name)}?`;
        if (confirmBtn) confirmBtn.disabled = false;

        modal.classList.remove('hidden');
        requestAnimationFrame(() => modal.classList.add('visible'));
    }
}

function closeDeleteUserModal() {
    userToDeleteId = null;
    const modal = document.getElementById('deleteUserModal');
    if (modal) {
        modal.classList.remove('visible');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
}

async function confirmDeleteUser() {
    if (!userToDeleteId) return;

    const confirmBtn = document.getElementById('confirmDeleteUserBtn');
    confirmBtn.disabled = true;
    confirmBtn.innerText = 'Deleting...';

    const token = localStorage.getItem('authToken');

    try {
        const response = await fetch(`/api/users/${userToDeleteId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showNotification('Success', data.message, 'success');
            setTimeout(() => {
                closeDeleteUserModal();
                // Refresh list
                const currentFilter = document.querySelector('#teamsGroupFilterDropdown .selected-text').textContent;
                const filterVal = currentFilter === 'All Groups' ? 'all' : document.querySelector('#teamsGroupFilterDropdown .option.selected')?.dataset.value || 'all';
                loadManagedUsers(filterVal);
            }, 500);
        } else {
            showNotification('Error', data.message || 'Failed to delete user.', 'error');
            confirmBtn.disabled = false;
            confirmBtn.innerText = 'Confirm Delete';
        }
    } catch (error) {
        console.error("Delete User Error:", error);
        showNotification('Error', 'An unexpected error occurred.', 'error');
        confirmBtn.disabled = false;
        confirmBtn.innerText = 'Confirm Delete';
    }
}

// Expose to window for inline onclicks if needed, though event delegation is better.
window.openDeleteUserModal = openDeleteUserModal;

// Add Member Handler (Mock for now, can be updated for real API)
document.addEventListener('DOMContentLoaded', () => {

    // Attach Delete User Modal Listeners (Modal Buttons)
    const closeDeleteBtn = document.getElementById('closeDeleteUserBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteUserBtn');
    if (closeDeleteBtn) closeDeleteBtn.addEventListener('click', closeDeleteUserModal);
    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', confirmDeleteUser);

    // Event Delegation for Table Actions (Delete & Edit Buttons)
    const userListContainer = document.getElementById('managedUsersList');
    if (userListContainer) {
        userListContainer.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-btn');
            if (deleteBtn) {
                const id = deleteBtn.dataset.id;
                const name = deleteBtn.dataset.name;
                openDeleteUserModal(id, name);
            }
            const editBtn = e.target.closest('.edit-btn');
            if (editBtn) {
                const data = {
                    id: editBtn.dataset.id,
                    name: editBtn.dataset.name, // Careful with quotes? Dataset handles it if set via HTML correctly
                    email: editBtn.dataset.email,
                    job: editBtn.dataset.job,
                    role: editBtn.dataset.role,
                    gid: editBtn.dataset.gid
                };
                openEditUserModal(data);
            }
        });
    }

    // System Tasks (Manage Tasks) Delegation
    let taskToDeleteId = null;
    const systemTasksList = document.getElementById('systemTasksList');
    const deleteTaskModal = document.getElementById('deleteTaskModal');
    const closeDeleteTaskModalBtn = document.getElementById('closeDeleteTaskModalBtn');
    const cancelDeleteTaskBtn = document.getElementById('cancelDeleteTaskBtn');
    const confirmDeleteTaskBtn = document.getElementById('confirmDeleteTaskBtn');

    // Close Modal Function
    const closeDeleteTaskModal = () => {
        if (deleteTaskModal) deleteTaskModal.classList.remove('visible');
        taskToDeleteId = null;
    };

    // Attach Listeners
    if (closeDeleteTaskModalBtn) closeDeleteTaskModalBtn.addEventListener('click', closeDeleteTaskModal);
    if (cancelDeleteTaskBtn) cancelDeleteTaskBtn.addEventListener('click', closeDeleteTaskModal);

    if (systemTasksList) {
        systemTasksList.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-task-btn');
            if (deleteBtn) {
                taskToDeleteId = deleteBtn.dataset.id;
                if (deleteTaskModal) deleteTaskModal.classList.add('visible');
            }
        });
    }

    if (confirmDeleteTaskBtn) {
        confirmDeleteTaskBtn.addEventListener('click', () => {
            if (!taskToDeleteId) return;

            confirmDeleteTaskBtn.innerText = 'Deleting...';
            confirmDeleteTaskBtn.disabled = true;

            const token = localStorage.getItem('authToken');

            fetch(`/api/tasks/${taskToDeleteId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        showNotification('Success', data.message || 'Task deleted successfully.', 'success');
                        closeDeleteTaskModal(); // Close modal immediately
                        window.loadSystemTasks();
                    } else {
                        showNotification('Error', data.message || 'Failed to delete task.', 'error');
                    }
                })
                .catch(err => {
                    console.error('Delete Task Error:', err);
                    showNotification('Error', 'An unexpected error occurred.', 'error');
                })
                .finally(() => {
                    confirmDeleteTaskBtn.innerText = 'Yes, Delete It';
                    confirmDeleteTaskBtn.disabled = false;
                });
        });
    }

    // Attach Edit User Modal Listeners
    const closeEditBtn = document.getElementById('closeEditMemberBtn');
    const confirmEditBtn = document.getElementById('confirmEditMemberBtn');
    if (closeEditBtn) closeEditBtn.addEventListener('click', closeEditUserModal);
    if (confirmEditBtn) confirmEditBtn.addEventListener('click', confirmEditUser);

    // Edit Modal Input Sanitization
    const editName = document.getElementById('editMemberName');
    const editEmail = document.getElementById('editMemberEmail');
    const editJob = document.getElementById('editMemberJob');

    if (editName) editName.addEventListener('input', (e) => e.target.value = e.target.value.replace(/[^a-zA-Z ]/g, ''));
    if (editEmail) editEmail.addEventListener('input', (e) => e.target.value = e.target.value.replace(/[^a-zA-Z0-9.@_-]/g, ''));
    if (editJob) editJob.addEventListener('input', (e) => {
        let val = e.target.value.toUpperCase();
        e.target.value = val.replace(/[^A-Z_-]/g, '');
    });

    // Real-time Input Sanitization (Moved here to be active immediately)
    const nameInput = document.getElementById('addMemberName');
    const emailInput = document.getElementById('addMemberEmail');
    const jobInput = document.getElementById('addMemberJob');

    if (nameInput) {
        nameInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^a-zA-Z ]/g, '');
        });
    }
    if (emailInput) {
        emailInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^a-zA-Z0-9.@_-]/g, '');
        });
    }
    if (jobInput) {
        jobInput.addEventListener('input', (e) => {
            let val = e.target.value.toUpperCase();
            e.target.value = val.replace(/[^A-Z_-]/g, '');
        });
    }

    const confirmAddBtn = document.getElementById('confirmAddMemberBtn');
    if (confirmAddBtn) {
        confirmAddBtn.addEventListener('click', () => {
            const name = document.getElementById('addMemberName').value;
            const email = document.getElementById('addMemberEmail').value;
            const job = document.getElementById('addMemberJob').value;

            // Get selected group ID from dataset (set by callback) or by re-querying options
            const groupSelect = document.getElementById('addMemberGroupSelect');
            const groupId = groupSelect ? groupSelect.getAttribute('data-selected-id') : null;

            if (!groupId || groupId === 'all') {
                showNotification('Validation Error', 'Please select a valid group.', 'error');
                return;
            }

            if (!groupId || groupId === 'all') {
                showNotification('Validation Error', 'Please select a valid group.', 'error');
                return;
            }

            // Strict Client-Side Validation (Fast Feedback)
            if (!/^[a-zA-Z ]+$/.test(name)) {
                showNotification('Validation Error', 'Name must contain only letters and spaces.', 'error');
                return;
            }
            if (email.length > 40) {
                showNotification('Validation Error', 'Email must be 40 characters or less.', 'error');
                return;
            }
            // Job is formatted by backend, so we might not be strict here, 
            // but we can warn about length.
            if (job.length > 20) {
                showNotification('Validation Error', 'Job title too long (max 20 chars).', 'error');
                return;
            }

            confirmAddBtn.disabled = true;
            confirmAddBtn.innerText = 'Adding...';

            // Get Role
            const roleSelect = document.getElementById('addMemberRoleSelect');
            const role = roleSelect ? (roleSelect.querySelector('.option.selected')?.getAttribute('data-value') || 'NORMAL') : 'NORMAL';

            const token = localStorage.getItem('authToken');
            if (!token) {
                showNotification('Error', 'You must be logged in.', 'error');
                return;
            }

            fetch('/api/users/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ fullName: name, email, job, gid: groupId, role })
            })
                .then(async res => {
                    const isJson = res.headers.get('content-type')?.includes('application/json');
                    const data = isJson ? await res.json() : null;
                    const text = !isJson ? await res.text() : null;

                    if (!res.ok) {
                        // Log the raw text if not JSON
                        const errorMsg = (data && data.message) || text || res.statusText;
                        throw new Error(errorMsg);
                    }
                    return data;
                })
                .then(data => {
                    if (data.success) {
                        showNotification('Success', data.message || 'Member added successfully!', 'success');
                        setTimeout(() => {
                            closeAddMemberModal();
                            const currentFilter = document.querySelector('#teamsGroupFilterDropdown .selected-text').textContent;
                            const filterVal = currentFilter === 'All Groups' ? 'all' : document.querySelector('#teamsGroupFilterDropdown .option.selected')?.dataset.value || 'all';
                            loadManagedUsers(filterVal);
                        }, 1000);
                    } else {
                        showNotification('Error', data.message || 'Failed to add member.', 'error');
                    }
                })
                .catch(err => {
                    console.error('Add Member Error:', err);
                    // Show the actual error message from server if available
                    showNotification('Error', `Failed: ${err.message}`, 'error');
                })
                .finally(() => {
                    confirmAddBtn.disabled = false;
                    confirmAddBtn.innerText = 'Add Member';
                });
        });
    }

    const closeAddBtn = document.getElementById('closeAddMemberBtn');
    if (closeAddBtn) {
        closeAddBtn.addEventListener('click', closeAddMemberModal);
    }
});

// --- Helper Functions (Global) ---
function loadGroupsIntoDropdown(dropdownId, onChangeCallback, includeAll = true) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;

    const optionsContainer = dropdown.querySelector('.select-options');

    fetch('/api/groups')
        .then(res => res.json())
        .then(groups => {
            // Reset options
            optionsContainer.innerHTML = '';

            if (includeAll) {
                optionsContainer.innerHTML += '<div class="option selected" data-value="all">All Groups</div>';
            } else {
                // If not including All, maybe add a placeholder if none selected? 
                // HTML already has a placeholder "Select Group" usually, but we wiped it.
                // Let's add a disabled placeholder or just the groups.
                // Better: Check if we have a "Select Group" initially? 
                // We'll just add the groups. The 'selected-text' in HTML handles the label.
                // We should make the first group selected OR keep no selection.
                // Let's add a placeholder option that is hidden/disabled?
                // Or just don't select anything by default.
            }

            groups.forEach(group => {
                const opt = document.createElement('div');
                opt.className = 'option';
                opt.setAttribute('data-value', group.id);
                opt.textContent = escapeHtml(group.name);
                optionsContainer.appendChild(opt);
            });

            // If includeAll is false, we might want to ensure the "Select Group" text is preserved or reset.
            // But custom select logic relies on .option being clicked.

            bindCustomSelectLogic(dropdown, onChangeCallback);
        })
        .catch(err => console.error('Failed to load groups for dropdown:', err));
}



function bindCustomSelectLogic(customSelect, callback) {
    const trigger = customSelect.querySelector('.select-trigger');
    const selectedText = customSelect.querySelector('.selected-text');

    const newTrigger = trigger.cloneNode(true);
    trigger.parentNode.replaceChild(newTrigger, trigger);

    newTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.custom-select.open').forEach(s => {
            if (s !== customSelect) s.classList.remove('open');
        });
        customSelect.classList.toggle('open');
    });

    const options = customSelect.querySelectorAll('.option');
    options.forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            options.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');

            const text = option.textContent;
            customSelect.querySelector('.selected-text').textContent = text;

            customSelect.classList.remove('open');

            const value = option.getAttribute('data-value');
            if (callback) callback(value);
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const openAddBtn = document.getElementById('openAddMemberBtn');
    if (openAddBtn) {
        openAddBtn.addEventListener('click', (e) => {
            e.preventDefault(); // Good practice for button clicks
            openAddMemberModal();
        });
        console.log('Add Member Button Listener Attached');
    } else {
        console.error('Add Member Button NOT FOUND');
    }
});

// --- Add Task Modal Logic (Appended Safe Block) ---
document.addEventListener('DOMContentLoaded', () => {
    const addTaskModal = document.getElementById('addTaskModal');
    const openAddTaskBtn = document.getElementById('openCreateTaskBtn');
    const closeAddTaskBtn = document.getElementById('closeAddTaskModalBtn');
    const cancelAddTaskBtn = document.getElementById('cancelCreateTaskBtn');
    const createTaskForm = document.getElementById('createTaskForm');

    // 1. Open/Close Logic
    if (openAddTaskBtn) {
        console.log('Add Task Button Found (Safe Block)');
        openAddTaskBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Add Task Button Clicked (Safe Block)');
            if (addTaskModal) {
                addTaskModal.classList.remove('hidden');
                // Force reflow for transition
                void addTaskModal.offsetWidth;
                addTaskModal.classList.add('visible');
                populateCreateTaskGroups();
            } else {
                console.error('AddTaskModal not found');
            }
        });
    } else {
        console.error('openCreateTaskBtn not found in Safe Block');
    }

    const closeAddTask = (e) => {
        if (e) e.preventDefault();
        if (addTaskModal) {
            addTaskModal.classList.remove('visible');
            setTimeout(() => {
                addTaskModal.classList.add('hidden');
            }, 300);
        }
        if (createTaskForm) createTaskForm.reset();

        // Reset Custom Selects
        document.querySelectorAll('.custom-select .selected-text').forEach(el => {
            if (el.parentElement.parentElement.id.includes('Status')) el.textContent = 'Select Status';
            else if (el.parentElement.parentElement.id.includes('Criticality')) el.textContent = 'Select Level';
        });

        // Reset Hidden Inputs
        const critInput = document.getElementById('newTaskCriticalityInput');
        const statusInput = document.getElementById('newTaskStatusInput');
        if (critInput) critInput.value = '';
        if (statusInput) statusInput.value = '';
    };

    if (closeAddTaskBtn) closeAddTaskBtn.addEventListener('click', closeAddTask);
    if (cancelAddTaskBtn) cancelAddTaskBtn.addEventListener('click', closeAddTask);

    // 2. Populate Groups
    function populateCreateTaskGroups() {
        const container = document.getElementById('createTaskGroupOptions');
        if (!container || container.children.length > 0) return;

        fetch('/api/groups')
            .then(res => res.json())
            .then(groups => {
                container.innerHTML = '';
                groups.forEach(group => {
                    const label = document.createElement('label');
                    label.classList.add('checkbox-item');
                    label.innerHTML = `
                    <input type="checkbox" value="${group.id}" name="newTaskGroup">
                    <span class="custom-checkbox"></span>
                    ${escapeHtml(group.name)}
                `;
                    container.appendChild(label);
                });
            })
            .catch(err => console.error('Groups load error:', err));
    }

    // Initialize Criticality Segmented Control
    const critOptions = document.querySelectorAll('.crit-option');
    critOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            critOptions.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            document.getElementById('newTaskCriticalityInput').value = opt.getAttribute('data-value');
        });
    });

    // 3. Submit Handler
    if (createTaskForm) {
        createTaskForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const title = document.getElementById('newTaskTitle').value.trim();
            const desc = document.getElementById('newTaskDesc').value.trim();
            const deadline = document.getElementById('newTaskDeadline').value;

            const criticality = document.getElementById('newTaskCriticalityInput').value;
            const selectedGroups = Array.from(document.querySelectorAll('input[name="newTaskGroup"]:checked')).map(cb => cb.value);

            if (!criticality) return showNotification('Validation Error', 'Select Criticality', 'error');
            if (selectedGroups.length === 0) return showNotification('Validation Error', 'Assign to at least one group', 'error');

            // Validation Checks
            if (!/^[a-zA-Z@\-_ ]+$/.test(title)) return showNotification('Validation Error', 'Title contains invalid characters.', 'error');
            if (!/^[a-zA-Z@\-_ ]+$/.test(desc)) return showNotification('Validation Error', 'Description contains invalid characters.', 'error');

            if (new Date(deadline) < new Date()) {
                return showNotification('Validation Error', 'Deadline cannot be in the past.', 'error');
            }

            const payload = {
                title, description: desc, criticality,
                end_time: deadline, gids: selectedGroups
            };

            const token = localStorage.getItem('authToken');
            fetch('/api/tasks/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        showNotification('Success', 'Task created successfully!', 'success');
                        closeAddTask();
                        window.loadSystemTasks();
                    } else {
                        showNotification('Error', data.message, 'error');
                    }
                })
                .catch(err => {
                    console.error(err);
                    showNotification('System Error', 'Failed to create task.', 'error');
                });
        });
    }
});



// --- Edit Task Logic ---
let isEditingTask = false;

function openEditTaskModal(taskId) {
    const modal = document.getElementById('editTaskModal');
    if (!modal) return;

    // Set State
    isEditingTask = true;
    document.getElementById('editTaskId').value = taskId;

    // UI Loading State (Optional) or clear previous
    document.getElementById('editTaskTitle').value = 'Loading...';

    // Open Modal with Animation
    modal.classList.remove('hidden');
    requestAnimationFrame(() => modal.classList.add('visible'));

    // Fetch Task Details
    const token = localStorage.getItem('authToken');
    fetch(`/api/tasks/${taskId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
        .then(res => res.json())
        .then(task => {
            if (!task || task.error) {
                showNotification('Error', 'Failed to load task details', 'error');
                closeEditTaskModal();
                return;
            }

            // Populate Fields
            document.getElementById('editTaskTitle').value = task.title;
            document.getElementById('editTaskDesc').value = task.description;

            // Criticality
            const critInput = document.getElementById('editTaskCriticalityInput');
            const critSelect = document.getElementById('editTaskCriticalitySelect');
            if (critInput && critSelect) {
                critInput.value = task.criticality;
                const textSpan = critSelect.querySelector('.selected-text');
                // Update visual text
                const map = { 'high': 'High', 'med': 'Medium', 'low': 'Low' };
                textSpan.innerHTML = `${map[task.criticality] || task.criticality} <span class="critic-dot critic-${task.criticality}" style="margin-left: 10px;"></span>`;
            }

            // Status
            const statusInput = document.getElementById('editTaskStatusInput');
            const statusSelect = document.getElementById('editTaskStatusSelect');
            if (statusInput && statusSelect) {
                const cleanStatus = task.status || 'NOT_STARTED';
                statusInput.value = cleanStatus;

                // Map values to display text
                const statusMap = {
                    'NOT_STARTED': 'Not Started',
                    'in-progress': 'In Progress',
                    'completed': 'Completed',
                    'failed': 'Failed'
                };

                const display = statusMap[cleanStatus] || cleanStatus;
                statusSelect.querySelector('.selected-text').textContent = display;
            }

            // Deadline (Format for datetime-local: YYYY-MM-DDTHH:mm)
            if (task.deadline) {
                const d = new Date(task.deadline);
                // Adjust to local ISO string roughly or use library. 
                // Simple hack for local time:
                d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                document.getElementById('editTaskDeadline').value = d.toISOString().slice(0, 16);
            }

            // Load Groups and Check Assigned Ones
            loadGroupsForEdit(task.groups || []); // task.groups should be array of IDs or strings
        })
        .catch(err => {
            console.error('Error fetching task details:', err);
            showNotification('Error', 'Could not load task.', 'error');
            closeEditTaskModal();
        });
}

function loadGroupsForEdit(assignedGroupIds) {
    const container = document.getElementById('editTaskGroupOptions');
    if (!container) return;

    fetch('/api/groups')
        .then(res => res.json())
        .then(groups => {
            container.innerHTML = '';
            // Process assignedGroupIds to ensure they are strings for comparison
            const assignedSet = new Set(assignedGroupIds.map(id => String(id)));

            if (groups.length === 0) {
                container.innerHTML = '<div style="text-align:center; padding:0.5rem;">No groups available</div>';
                return;
            }

            groups.forEach(group => {
                const label = document.createElement('label');
                label.className = 'checkbox-item';
                const isChecked = assignedSet.has(String(group.id)) ? 'checked' : '';

                label.innerHTML = `
                    <input type="checkbox" value="${group.id}" name="editTaskGroup" ${isChecked}>
                    <span class="custom-checkbox"></span>
                    ${escapeHtml(group.name)}
                `;
                container.appendChild(label);
            });
        })
        .catch(err => {
            console.error('Error loading groups for edit:', err);
            container.innerHTML = '<div style="color:red; text-align:center;">Failed to load groups</div>';
        });

}

function closeEditTaskModal() {
    const modal = document.getElementById('editTaskModal');
    if (modal) {
        modal.classList.remove('visible');
        setTimeout(() => {
            modal.classList.add('hidden');
            isEditingTask = false;
        }, 300);
    }
}

// Save Edit Task
async function saveEditTask(e) {
    e.preventDefault();
    const taskId = document.getElementById('editTaskId').value;
    if (!taskId) return;

    const title = document.getElementById('editTaskTitle').value;
    const description = document.getElementById('editTaskDesc').value;
    const criticality = document.getElementById('editTaskCriticalityInput').value;
    const status = document.getElementById('editTaskStatusInput').value;
    const deadline = document.getElementById('editTaskDeadline').value;

    // Get Selected Groups
    const selectedGroups = Array.from(document.querySelectorAll('input[name="editTaskGroup"]:checked'))
        .map(cb => cb.value);

    // Validation
    if (!title || !description || !criticality || !deadline) {
        showNotification('Validation Error', 'All fields are required.', 'error');
        return;
    }
    if (selectedGroups.length === 0) {
        showNotification('Validation Error', 'Please assign at least one group.', 'error');
        return;
    }

    const btn = document.getElementById('saveEditTaskBtn');
    btn.disabled = true;
    btn.innerText = 'Saving...';

    const token = localStorage.getItem('authToken');

    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                title,
                description,
                criticality,
                status,
                deadline,
                groups: selectedGroups
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showNotification('Success', 'Task updated successfully', 'success');
            closeEditTaskModal();
            loadSystemTasks(); // Refresh List
        } else {
            showNotification('Error', data.message || 'Failed to update task', 'error');
        }
    } catch (err) {
        console.error('Update Task Error:', err);
        showNotification('Error', 'Unexpected: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Save Changes';
    }
}

// Initialize Logic
document.addEventListener('DOMContentLoaded', () => {
    // 1. Close Buttons
    const closeBtn = document.getElementById('closeEditTaskModalBtn');
    const cancelBtn = document.getElementById('cancelEditTaskBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeEditTaskModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeEditTaskModal);

    // 2. Form Submit
    const form = document.getElementById('editTaskForm');
    if (form) form.addEventListener('submit', saveEditTask);

    // 3. Custom Select Logic for Criticality in Edit Modal
    const critSelect = document.getElementById('editTaskCriticalitySelect');
    if (critSelect) {
        const trigger = critSelect.querySelector('.select-trigger');
        const options = critSelect.querySelectorAll('.option');
        const input = document.getElementById('editTaskCriticalityInput');

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close others
            document.querySelectorAll('.custom-select.open').forEach(s => {
                if (s !== critSelect) s.classList.remove('open');
            });
            critSelect.classList.toggle('open');
        });

        options.forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                const val = opt.getAttribute('data-value');
                const html = opt.innerHTML; // Includes the dot

                // Set Visual
                critSelect.querySelector('.selected-text').innerHTML = html;
                // Set Input
                if (input) input.value = val;

                critSelect.classList.remove('open');
            });
        });
    }

    // Custom Select for Status in Edit Modal
    const statusSelect = document.getElementById('editTaskStatusSelect');
    if (statusSelect) {
        bindCustomSelectLogic(statusSelect, (val) => {
            document.getElementById('editTaskStatusInput').value = val;
        });
    }

    // 4. Attach Event Delegation for Edit Button (if not already handled or reuse existing)
    // We'll append this to the existing listener block or add a new one. 
    // Since we can't easily edit the middle of the big DOMContentLoaded block in script.js without context, 
    // we'll explicitly add a listener to the systemTasksList here if it's safe.

    const tasksList = document.getElementById('systemTasksList');
    if (tasksList) {
        tasksList.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-task-btn');
            if (editBtn) {
                const id = editBtn.dataset.id;
                openEditTaskModal(id);
            }
        });
    }
});
// --- Leaderboard Logic ---
function loadLeaderboard() {
    console.log('Loading Leaderboard...');
    // Identify which leaderboard table body exists on the current page
    let tbody = document.getElementById('leaderboardListTeacher') ||
        document.getElementById('leaderboardListLeader') ||
        document.getElementById('leaderboardListCell');

    if (!tbody) {
        console.warn('Leaderboard table body not found.');
        return;
    }

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 1rem;">Loading...</td></tr>';

    fetch('/api/groups')
        .then(res => res.json())
        .then(groups => {
            // Sort by Score Descending
            groups.sort((a, b) => (b.score || 0) - (a.score || 0));

            tbody.innerHTML = '';

            if (groups.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 1rem;">No groups found</td></tr>';
                return;
            }

            groups.forEach((group, index) => {
                const tr = document.createElement('tr');
                if (index < 3) tr.className = 'top-rank';

                tr.innerHTML = `
                    <td>
                        <div class="rank-badge rank-${index + 1}">${index + 1}</div>
                    </td>
                    <td>${escapeHtml(group.name)}</td>
                    <td style="font-weight: 600; color: var(--premium-accent);">${group.score || 0} XP</td>
                    <td>${group.count || 0}</td>
                    <td>${group.completed_count || 0}</td>
                `;
                tbody.appendChild(tr);
            });
        })
        .catch(err => {
            console.error('Error loading leaderboard:', err);
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #ff4d4d;">Failed to load leaderboard</td></tr>';
        });
}


// --- User Profile Logic ---

function loadUserProfile() {
    console.log('Loading User Profile...');
    const nameInput = document.getElementById('profileName') || document.getElementById('profileNameLeader') || document.getElementById('profileNameCell');
    const emailInput = document.getElementById('profileEmail') || document.getElementById('profileEmailLeader') || document.getElementById('profileEmailCell');
    const phoneInput = document.getElementById('profilePhone') || document.getElementById('profilePhoneLeader') || document.getElementById('profilePhoneCell');

    if (!nameInput) return;

    const token = localStorage.getItem('authToken');
    if (!token) {
        console.warn('No authentication token found.');
        return;
    }

    fetch('/api/profile', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then(data => {
            if (data.success) {
                const user = data.user;
                if (nameInput) nameInput.value = user.full_name || '';
                if (emailInput) emailInput.value = user.email || '';
                if (phoneInput) phoneInput.value = user.phone_number || '';
            }
        })
        .catch(err => {
            console.error('Error loading profile:', err);
        });
}

function initProfileSettings() {
    const form = document.getElementById('profileSettingsForm') || document.getElementById('profileSettingsFormLeader') || document.getElementById('profileSettingsFormCell');

    if (form) {
        // Input Masking / Validation Listeners
        const nameInput = form.querySelector('input[type="text"]');
        const emailInput = form.querySelector('input[type="email"]');
        const phoneInput = form.querySelector('input[type="tel"]');

        if (nameInput) {
            nameInput.addEventListener('input', () => {
                nameInput.value = nameInput.value.replace(/[^a-zA-Z ]/g, '').slice(0, 30);
            });
        }

        if (phoneInput) {
            phoneInput.addEventListener('input', () => {
                phoneInput.value = phoneInput.value.replace(/[^0-9]/g, '').slice(0, 10);
            });
        }

        if (emailInput) {
            emailInput.addEventListener('input', () => {
                if (emailInput.value.length > 40) {
                    emailInput.value = emailInput.value.slice(0, 40);
                }
            });
        }

        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const nameInput = form.querySelector('input[type="text"]');
            const emailInput = form.querySelector('input[type="email"]');
            const phoneInput = form.querySelector('input[type="tel"]');
            const btn = form.querySelector('button[type="submit"]');

            const payload = {
                full_name: nameInput.value,
                email: emailInput.value,
                phone_number: phoneInput.value
            };

            const originalBtnText = btn.textContent;
            btn.textContent = 'Saving...';
            btn.disabled = true;

            const token = localStorage.getItem('authToken');

            fetch('/api/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        showNotification('Success', 'Profile updated successfully!', 'success');
                        loadUserProfile();
                    } else {
                        showNotification('Error', data.message || 'Failed to update profile.', 'error');
                    }
                })
                .catch(err => {
                    console.error('Error updating profile:', err);
                    showNotification('Error', 'An error occurred while updating profile.', 'error');
                })
                .finally(() => {
                    btn.textContent = originalBtnText;
                    btn.disabled = false;
                });
        });
    }
}

// --- Change Password Logic ---
function initChangePassword() {
    const form = document.getElementById('changePasswordForm') ||
        document.getElementById('changePasswordFormLeader') ||
        document.getElementById('changePasswordFormCell');

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const oldPassInput = form.querySelector('input[placeholder="Current Password"]');
            const newPassInput = form.querySelector('input[placeholder="New Password"]');
            const confirmPassInput = form.querySelector('input[placeholder="Confirm New Password"]');
            const btn = form.querySelector('button[type="submit"]');

            const oldPassword = oldPassInput.value;
            const newPassword = newPassInput.value;
            const confirmPassword = confirmPassInput.value;

            // 1. Client-side Validation
            if (newPassword !== confirmPassword) {
                showNotification('Error', 'New passwords do not match.', 'error');
                return;
            }

            if (newPassword.length < 6) {
                showNotification('Error', 'Password must be at least 6 characters.', 'error');
                return;
            }

            const originalBtnText = btn.textContent;
            btn.textContent = 'Updating...';
            btn.disabled = true;

            const token = localStorage.getItem('authToken');

            fetch('/api/profile/password', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ oldPassword, newPassword })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        showNotification('Success', data.message, 'success');
                        form.reset();
                    } else {
                        showNotification('Error', data.message || 'Failed to change password.', 'error');
                    }
                })
                .catch(err => {
                    console.error('Change password error:', err);
                    showNotification('Error', 'An error occurred.', 'error');
                })
                .finally(() => {
                    btn.textContent = originalBtnText;
                    btn.disabled = false;
                });
        });
    }
}


function initPasswordToggles() {
    const toggleBtns = document.querySelectorAll('.toggle-password-btn');

    toggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.previousElementSibling;
            if (input && input.tagName === 'INPUT') {
                const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
                input.setAttribute('type', type);

                // Update Icon
                if (type === 'text') {
                    // Show "Eye Slash" (meaning click to hide)
                    btn.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                        </svg>
                    `;
                } else {
                    // Show "Eye"
                    btn.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                            stroke-linejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                        </svg>
                    `;
                }
            }
        });
    });
}

// Initial Call
// We append this here to ensure it runs when script is loaded/reloaded
// In a real module system we'd export it, but here we just call it or ensure it's called on load
document.addEventListener('DOMContentLoaded', () => {
    // Re-run inits in case script is loaded after DOM
    initProfileSettings();
    initChangePassword();
    initPasswordToggles();
    // loadUserProfile is called by specific page logic usually, or we can ensuring it here
    loadUserProfile();
});
