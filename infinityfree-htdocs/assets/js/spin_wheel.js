(function () {
  'use strict';

  var canvas = document.getElementById('luckyWheelCanvas');
  var spinBtn = document.getElementById('spinNowBtn');
  var resultEl = document.getElementById('spinResultBanner');
  if (!canvas || !spinBtn) return;

  var SEGMENTS = [
    { label: '10 RWF', value: 10, color: '#0f172a' },
    { label: '20 RWF', value: 20, color: '#1e3a8a' },
    { label: '40 RWF', value: 40, color: '#065f46' },
    { label: '50 RWF', value: 50, color: '#0d9488' },
    { label: '80 RWF', value: 80, color: '#1d4ed8' },
    { label: '100 RWF', value: 100, color: '#047857' },
    { label: '150 RWF', value: 150, color: '#b45309' },
    { label: '200 RWF', value: 200, color: '#4338ca' },
    { label: '500 RWF', value: 500, color: '#991b1b' },
  ];

  var currentRotation = 0;
  var spinning = false;

  function drawWheel(angleRad) {
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var size = canvas.width;
    var center = size / 2;
    var radius = center - 12;
    var sliceAngle = (2 * Math.PI) / SEGMENTS.length;

    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(center, center, radius + 6, 0, 2 * Math.PI);
    ctx.fillStyle = '#071B38';
    ctx.fill();

    SEGMENTS.forEach(function (seg, idx) {
      var start = angleRad + idx * sliceAngle;
      var end = start + sliceAngle;

      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = seg.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.stroke();

      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(start + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px "JetBrains Mono", monospace';
      ctx.fillText(seg.label, radius - 14, 5);
      ctx.restore();
    });

    ctx.beginPath();
    ctx.arc(center, center, 26, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#071B38';
    ctx.stroke();

    ctx.fillStyle = '#071B38';
    ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SPIN', center, center + 4);
  }

  drawWheel(0);

  spinBtn.addEventListener('click', function () {
    if (spinning) return;
    spinning = true;
    spinBtn.disabled = true;
    if (resultEl) resultEl.classList.add('hidden');

    var csrf = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
    fetch('/api/spin.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf },
      body: JSON.stringify({ csrf_token: csrf }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.ok) {
          spinning = false;
          spinBtn.disabled = false;
          if (resultEl) {
            resultEl.textContent = data.error || 'No spin credits left.';
            resultEl.className = 'alert alert-error';
          }
          return;
        }

        var targetIndex = parseInt(data.segment_index, 10);
        if (isNaN(targetIndex) || targetIndex < 0 || targetIndex >= SEGMENTS.length) {
          targetIndex = 0;
        }

        var sliceAngle = (2 * Math.PI) / SEGMENTS.length;
        var desiredAngle = -Math.PI / 2 - (targetIndex + 0.5) * sliceAngle;
        var currentMod = currentRotation % (2 * Math.PI);
        var delta = (5 * 2 * Math.PI) + ((desiredAngle - currentMod + 4 * Math.PI) % (2 * Math.PI));

        var startRot = currentRotation;
        var endRot = startRot + delta;
        var startTime = performance.now();
        var duration = 4000;

        function animate(now) {
          var t = Math.min(1, (now - startTime) / duration);
          var eased = 1 - Math.pow(1 - t, 3);
          currentRotation = startRot + (endRot - startRot) * eased;
          drawWheel(currentRotation);
          if (t < 1) {
            requestAnimationFrame(animate);
          } else {
            spinning = false;
            if (resultEl) {
              resultEl.textContent = 'Congratulations! You won ' + data.reward_rwf + ' RWF — credited to your balance.';
              resultEl.className = 'alert alert-success';
            }
            setTimeout(function () { window.location.reload(); }, 1800);
          }
        }
        requestAnimationFrame(animate);
      })
      .catch(function () {
        spinning = false;
        spinBtn.disabled = false;
      });
  });
})();
