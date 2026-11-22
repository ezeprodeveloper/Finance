(function () {
  'use strict';

  // 1. Live Kigali Color-Changing Clock (Africa/Kigali CAT)
  function updateClock() {
    var digitsEl = document.getElementById('clockDigits');
    if (!digitsEl) return;
    try {
      var now = new Date();
      digitsEl.textContent = now.toLocaleTimeString('en-GB', {
        timeZone: 'Africa/Kigali',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch (err) {
      digitsEl.textContent = new Date().toTimeString().slice(0, 8);
    }
  }
  updateClock();
  setInterval(updateClock, 1000);

  // 2. Mobile Sidebar Drawer Toggle
  var sidebar = document.getElementById('portalSidebar');
  var openBtn = document.getElementById('openSidebarBtn');
  var closeBtn = document.getElementById('closeSidebarBtn');
  if (sidebar && openBtn) {
    openBtn.addEventListener('click', function () {
      sidebar.classList.add('open');
    });
  }
  if (sidebar && closeBtn) {
    closeBtn.addEventListener('click', function () {
      sidebar.classList.remove('open');
    });
  }

  // 3. Cascading Rwanda Location Dropdowns (District -> Sector -> Cell -> Village)
  function populateSelect(selectEl, items, placeholder, selectedValue) {
    if (!selectEl) return;
    selectEl.innerHTML = '';
    var opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = placeholder;
    selectEl.appendChild(opt0);
    (items || []).forEach(function (name) {
      var opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      if (selectedValue && selectedValue === name) {
        opt.selected = true;
      }
      selectEl.appendChild(opt);
    });
  }

  document.querySelectorAll('[data-rwanda-location]').forEach(function (container) {
    var tree = window.RWANDA_LOCATIONS || {};
    var selDist = container.querySelector('[data-loc="district"]');
    var selSec = container.querySelector('[data-loc="sector"]');
    var selCell = container.querySelector('[data-loc="cell"]');
    var selVil = container.querySelector('[data-loc="village"]');

    var initDist = container.getAttribute('data-init-district') || '';
    var initSec = container.getAttribute('data-init-sector') || '';
    var initCell = container.getAttribute('data-init-cell') || '';
    var initVil = container.getAttribute('data-init-village') || '';

    populateSelect(selDist, Object.keys(tree).sort(), '-- Select Akarere --', initDist);
    if (initDist && tree[initDist]) {
      populateSelect(selSec, Object.keys(tree[initDist]).sort(), '-- Select Umurenge --', initSec);
      if (initSec && tree[initDist][initSec]) {
        populateSelect(selCell, Object.keys(tree[initDist][initSec]).sort(), '-- Select Akagari --', initCell);
        if (initCell && tree[initDist][initSec][initCell]) {
          populateSelect(selVil, tree[initDist][initSec][initCell], '-- Select Umudugudu --', initVil);
        }
      }
    }

    if (selDist) {
      selDist.addEventListener('change', function () {
        var sectors = tree[selDist.value] ? Object.keys(tree[selDist.value]).sort() : [];
        populateSelect(selSec, sectors, '-- Select Umurenge --', '');
        populateSelect(selCell, [], '-- Select Akagari --', '');
        populateSelect(selVil, [], '-- Select Umudugudu --', '');
      });
    }
    if (selSec) {
      selSec.addEventListener('change', function () {
        var cells = (tree[selDist.value] && tree[selDist.value][selSec.value])
          ? Object.keys(tree[selDist.value][selSec.value]).sort()
          : [];
        populateSelect(selCell, cells, '-- Select Akagari --', '');
        populateSelect(selVil, [], '-- Select Umudugudu --', '');
      });
    }
    if (selCell) {
      selCell.addEventListener('change', function () {
        var villages = (tree[selDist.value] && tree[selDist.value][selSec.value] && tree[selDist.value][selSec.value][selCell.value])
          ? tree[selDist.value][selSec.value][selCell.value]
          : [];
        populateSelect(selVil, villages, '-- Select Umudugudu --', '');
      });
    }
  });

  // 4. Multi-step Registration Wizard + Education Toggle
  var regForm = document.getElementById('registerWizardForm');
  if (regForm) {
    var currentStep = 1;
    var stepSections = [1, 2, 3].map(function (n) { return document.getElementById('regStep' + n); });
    var stepPills = [1, 2, 3].map(function (n) { return document.getElementById('stepPill' + n); });
    var prevBtn = document.getElementById('regPrevBtn');
    var nextBtn = document.getElementById('regNextBtn');
    var submitBtn = document.getElementById('regSubmitBtn');
    var errBox = document.getElementById('regClientError');

    function showStep(stepNum) {
      currentStep = stepNum;
      stepSections.forEach(function (sec, idx) {
        if (sec) sec.classList.toggle('hidden', idx + 1 !== stepNum);
      });
      stepPills.forEach(function (pill, idx) {
        if (!pill) return;
        pill.classList.remove('active', 'done');
        if (idx + 1 === stepNum) pill.classList.add('active');
        else if (idx + 1 < stepNum) pill.classList.add('done');
      });
      if (prevBtn) prevBtn.classList.toggle('hidden', stepNum === 1);
      if (nextBtn) nextBtn.classList.toggle('hidden', stepNum === 3);
      if (submitBtn) submitBtn.classList.toggle('hidden', stepNum !== 3);
      if (errBox) { errBox.classList.add('hidden'); errBox.textContent = ''; }
    }

    function showError(msg) {
      if (!errBox) return;
      errBox.textContent = msg;
      errBox.classList.remove('hidden');
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        if (currentStep === 1) {
          var nid = (document.getElementById('regNationalId').value || '').replace(/\s+/g, '');
          var photoInput = document.getElementById('regPhoto');
          if (!/^\d{16}$/.test(nid)) {
            showError('National ID must be exactly 16 digits.');
            return;
          }
          if (!photoInput || !photoInput.files || photoInput.files.length === 0) {
            showError('Please upload your identification photo.');
            return;
          }
          showStep(2);
        } else if (currentStep === 2) {
          showStep(3);
        }
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        if (currentStep > 1) showStep(currentStep - 1);
      });
    }

    // Education track toggle (University vs A-Level)
    var eduRadios = regForm.querySelectorAll('input[name="education_type"]');
    var lblInst = document.getElementById('lblInstitution');
    var lblLevel = document.getElementById('lblLevelClass');
    var lblFaculty = document.getElementById('lblFacultyComb');
    function syncEduLabels() {
      var selected = regForm.querySelector('input[name="education_type"]:checked');
      var isUni = !selected || selected.value === 'University';
      if (lblInst) lblInst.textContent = isUni ? 'University Name *' : "School's Name *";
      if (lblLevel) lblLevel.textContent = isUni ? 'Academic Level (Year 1-5 / Masters) *' : 'Class (S4 / S5 / S6) *';
      if (lblFaculty) lblFaculty.textContent = isUni ? 'Faculty / Department *' : 'Combination (PCM, MCB, MEG, etc.) *';
    }
    eduRadios.forEach(function (r) { r.addEventListener('change', syncEduLabels); });
    syncEduLabels();
  }

  // 5. 24-Hour Check-In Countdown Timer & AJAX Check-In
  var checkinBtn = document.getElementById('dailyCheckinBtn');
  var checkinCountdownEl = document.getElementById('checkinCountdown');
  if (checkinCountdownEl) {
    var remaining = parseInt(checkinCountdownEl.getAttribute('data-seconds') || '0', 10);
    if (remaining > 0) {
      setInterval(function () {
        if (remaining <= 0) {
          window.location.reload();
          return;
        }
        remaining--;
        var h = String(Math.floor(remaining / 3600)).padStart(2, '0');
        var m = String(Math.floor((remaining % 3600) / 60)).padStart(2, '0');
        var s = String(remaining % 60).padStart(2, '0');
        checkinCountdownEl.textContent = h + ':' + m + ':' + s;
      }, 1000);
    }
  }

  if (checkinBtn) {
    checkinBtn.addEventListener('click', function () {
      var csrf = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
      checkinBtn.disabled = true;
      fetch('/api/checkin.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf },
        body: JSON.stringify({ csrf_token: csrf }),
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.ok) {
            window.location.reload();
          } else {
            alert(data.error || 'Unable to claim check-in.');
            checkinBtn.disabled = false;
          }
        })
        .catch(function () {
          checkinBtn.disabled = false;
        });
    });
  }
})();
