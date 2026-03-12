<script>
(function(){
  const CONFIG = window.TATOA_BOOKING_CONFIG || {};
  const CART_KEY = CONFIG.cartKey || 'booking_cart';

  function formatPrice(num){
    return Number(num || 0).toLocaleString('ko-KR') + '원';
  }

  function generateCaptchaCode(){
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  function setCaptchaCode(root){
    const codeEl = root.querySelector('#simpleCaptchaCode');
    if(!codeEl) return;

    const code = generateCaptchaCode();
    codeEl.textContent = code;
    codeEl.dataset.code = code;
  }

  function getCaptchaCode(root){
    const codeEl = root.querySelector('#simpleCaptchaCode');
    return codeEl ? (codeEl.dataset.code || '') : '';
  }

  function getCart(){
    try{
      return JSON.parse(localStorage.getItem(CART_KEY)) || [];
    }catch(e){
      return [];
    }
  }

  function setCart(cart){
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }

  function addToCart(item){
    const cart = getCart();
    const exists = cart.find(v => v.id === item.id);
    if(!exists){
      cart.push(item);
      setCart(cart);
    }
  }

  function removeFromCart(id){
    const cart = getCart().filter(v => v.id !== id);
    setCart(cart);
    return cart;
  }

  function clearCart(){
    setCart([]);
  }

  function go(url){
    if(url) window.location.href = url;
  }

  function isSelectableDate(date){
    const now = new Date();
    now.setHours(0,0,0,0);

    const min = new Date(now);
    min.setDate(min.getDate() + (CONFIG.minDateOffset || 0));

    const max = new Date(now);
    max.setDate(max.getDate() + (CONFIG.maxDateOffset || 60));

    const weekday = date.getDay();
    const closed = (CONFIG.closedWeekdays || []).includes(weekday);

    if(date < min) return false;
    if(date > max) return false;
    if(closed) return false;
    return true;
  }

  function formatDateYMD(date){
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function openCartConfirm(){
    return confirm('장바구니에 저장 되었습니다.\n장바구니로 이동 하시겠습니까?');
  }

  /* 상세 페이지 */
  window.initServiceDetailPage = function(rootSelector, itemId){
    const root = document.querySelector(rootSelector);
    if(!root) return;

    const item = CONFIG.items?.[itemId];
    if(!item) return;

    const addBtn = root.querySelector('[data-role="add-cart"]');
    const bookBtn = root.querySelector('[data-role="go-booking"]');
    const check = root.querySelector('[data-role="svc-check"]');

    if(addBtn){
      addBtn.addEventListener('click', function(){
        addToCart(item);
        if(openCartConfirm()){
          go(CONFIG.cartPageUrl);
        }
      });
    }

    if(bookBtn){
      bookBtn.addEventListener('click', function(){
        addToCart(item);
        go(CONFIG.bookingPageUrl);
      });
    }

    if(check){
      check.checked = true;
    }
  };

  /* 장바구니 페이지 */
  window.initCartPage = function(rootSelector){
    const root = document.querySelector(rootSelector);
    if(!root) return;

    const listEl = root.querySelector('[data-role="cart-list"]');
    const countEls = root.querySelectorAll('[data-role="cart-count"]');
    const reserveBtn = root.querySelector('[data-role="cart-reserve-btn"]');
    const deleteSelectedBtn = root.querySelector('[data-role="delete-selected"]');
    const allCheck = root.querySelector('[data-role="all-check"]');

    function render(){
      const cart = getCart();

      countEls.forEach(el => el.textContent = cart.length);

      if(!cart.length){
        listEl.innerHTML = `<div class="empty-box">장바구니에 담긴 시술이 없습니다.</div>`;
        return;
      }

      listEl.innerHTML = cart.map(item => `
        <div class="cart-item" data-id="${item.id}">
          <div class="cart-item__name">
            <input type="checkbox" class="cart-item-check" data-id="${item.id}" checked>
            <span>${item.title}</span>
          </div>
          <div class="cart-item__price">
            ${item.originalPrice ? `<del>${formatPrice(item.originalPrice)}</del>` : ''}
            <strong>${formatPrice(item.price)}</strong>
          </div>
          <button type="button" class="cart-remove" data-role="remove-item" data-id="${item.id}">×</button>
        </div>
      `).join('');
    }

    render();

    if(listEl){
      listEl.addEventListener('click', function(e){
        const btn = e.target.closest('[data-role="remove-item"]');
        if(!btn) return;
        const id = btn.dataset.id;
        removeFromCart(id);
        render();
      });
    }

    if(deleteSelectedBtn){
      deleteSelectedBtn.addEventListener('click', function(){
        const checked = [...root.querySelectorAll('.cart-item-check:checked')].map(v => v.dataset.id);
        if(!checked.length) return;

        const cart = getCart().filter(item => !checked.includes(item.id));
        setCart(cart);
        render();
      });
    }

    if(allCheck){
      allCheck.addEventListener('change', function(){
        root.querySelectorAll('.cart-item-check').forEach(chk => {
          chk.checked = allCheck.checked;
        });
      });
    }

    if(reserveBtn){
      reserveBtn.addEventListener('click', function(){
        const checkedIds = [...root.querySelectorAll('.cart-item-check:checked')].map(v => v.dataset.id);

        if(!checkedIds.length){
          alert('예약할 시술을 선택해주세요.');
          return;
        }

        const selected = getCart().filter(item => checkedIds.includes(item.id));
        localStorage.setItem(CART_KEY, JSON.stringify(selected));
        go(CONFIG.bookingPageUrl);
      });
    }
  };

  /* 예약 페이지 */
  window.initBookingPage = function(rootSelector){
    const root = document.querySelector(rootSelector);
    if(!root) return;

    const cartListEl = root.querySelector('[data-role="booking-cart-list"]');
    const calendarTitle = root.querySelector('[data-role="calendar-title"]');
    const calendarDays = root.querySelector('[data-role="calendar-days"]');
    const prevMonthBtn = root.querySelector('[data-role="prev-month"]');
    const nextMonthBtn = root.querySelector('[data-role="next-month"]');
    const timeGrid = root.querySelector('[data-role="time-grid"]');
    const form = root.querySelector('[data-role="booking-form"]');
    const refreshCaptchaBtn = root.querySelector('#refreshCaptchaBtn');

    if(!cartListEl || !calendarTitle || !calendarDays || !timeGrid || !form) return;

    const cart = getCart();

    if(!cart.length){
      cartListEl.innerHTML = `<div class="empty-box">예약할 시술이 없습니다. 먼저 시술을 선택해주세요.</div>`;
    }else{
      cartListEl.innerHTML = cart.map(item => `
        <div class="cart-item" data-id="${item.id}">
          <div class="cart-item__name">
            <span>${item.title}</span>
          </div>
          <div class="cart-item__price">
            ${item.originalPrice ? `<del>${formatPrice(item.originalPrice)}</del>` : ''}
            <strong>${formatPrice(item.price)}</strong>
          </div>
          <button type="button" class="cart-remove" data-role="remove-booking-item" data-id="${item.id}">×</button>
        </div>
      `).join('');
    }

    cartListEl.addEventListener('click', function(e){
      const btn = e.target.closest('[data-role="remove-booking-item"]');
      if(!btn) return;
      const id = btn.dataset.id;
      const updated = removeFromCart(id);

      if(!updated.length){
        location.reload();
        return;
      }

      location.reload();
    });

    let currentMonth = new Date();
    currentMonth.setDate(1);

    let selectedDate = null;
    let selectedTime = null;

    function renderCalendar(){
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();

      calendarTitle.textContent = `${year}년 ${month + 1}월`;

      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const startWeekday = firstDay.getDay();
      const daysInMonth = lastDay.getDate();

      let html = '';

      for(let i = 0; i < startWeekday; i++){
        html += `<button type="button" class="calendar-day is-empty" disabled></button>`;
      }

      for(let day = 1; day <= daysInMonth; day++){
        const date = new Date(year, month, day);
        const ymd = formatDateYMD(date);
        const selectable = isSelectableDate(date);
        const selected = selectedDate === ymd;

        html += `
          <button
            type="button"
            class="calendar-day ${!selectable ? 'is-disabled' : ''} ${selected ? 'is-selected' : ''}"
            data-date="${ymd}"
            ${!selectable ? 'disabled' : ''}
          >
            ${day}
          </button>
        `;
      }

      calendarDays.innerHTML = html;
    }

    function renderTimes(){
      const slots = CONFIG.timeSlots || [];
      timeGrid.innerHTML = slots.map(time => `
        <button
          type="button"
          class="booking-time-btn ${selectedTime === time ? 'is-selected' : ''}"
          data-time="${time}"
        >${time}</button>
      `).join('');
    }

    renderCalendar();
    renderTimes();
    setCaptchaCode(root);

    if(refreshCaptchaBtn){
      refreshCaptchaBtn.addEventListener('click', function(){
        setCaptchaCode(root);
      });
    }

    if(prevMonthBtn){
      prevMonthBtn.addEventListener('click', function(){
        currentMonth.setMonth(currentMonth.getMonth() - 1);
        renderCalendar();
      });
    }

    if(nextMonthBtn){
      nextMonthBtn.addEventListener('click', function(){
        currentMonth.setMonth(currentMonth.getMonth() + 1);
        renderCalendar();
      });
    }

    calendarDays.addEventListener('click', function(e){
      const btn = e.target.closest('.calendar-day[data-date]');
      if(!btn) return;
      selectedDate = btn.dataset.date;
      renderCalendar();
    });

    timeGrid.addEventListener('click', function(e){
      const btn = e.target.closest('.booking-time-btn[data-time]');
      if(!btn) return;
      selectedTime = btn.dataset.time;
      renderTimes();
    });

    form.addEventListener('submit', async function(e){
      e.preventDefault();

      if(!cart.length){
        alert('예약할 시술이 없습니다.');
        return;
      }

      if(!selectedDate){
        alert('예약일을 선택해주세요.');
        return;
      }

      if(!selectedTime){
        alert('예약시간을 선택해주세요.');
        return;
      }

      const name = form.querySelector('[name="name"]').value.trim();
      const phone = form.querySelector('[name="phone"]').value.trim();
      const consultType = form.querySelector('[name="consultType"]:checked')?.value || '';
      const agreePrivacy = form.querySelector('[name="agreePrivacy"]').checked;
      const captchaInput = form.querySelector('[name="captchaInput"]')?.value.trim() || '';
      const captchaCode = getCaptchaCode(root);
      const honeypot = form.querySelector('[name="website"]')?.value.trim();

      if(!name){
        alert('이름을 입력해주세요.');
        return;
      }

      if(!phone){
        alert('연락처를 입력해주세요.');
        return;
      }

      if(honeypot){
        alert('비정상적인 접근이 감지되었습니다.');
        return;
      }

      if(!captchaInput){
        alert('자동입력방지 코드를 입력해주세요.');
        return;
      }

      if(captchaInput !== captchaCode){
        alert('자동입력방지 코드가 일치하지 않습니다.');
        setCaptchaCode(root);
        form.querySelector('[name="captchaInput"]').value = '';
        return;
      }

      if(!agreePrivacy){
        alert('개인정보 처리방침 동의가 필요합니다.');
        return;
      }

      const payload = {
        items: cart,
        bookingDate: selectedDate,
        bookingTime: selectedTime,
        bookingDateText: selectedDate,
        customer: {
          name,
          phone,
          consultType,
          agreeSms: form.querySelector('[name="agreeSms"]').checked,
          agreePrivacy
        },
        createdAt: new Date().toISOString()
      };

      try{
        if(CONFIG.submitEndpoint){
          const res = await fetch(CONFIG.submitEndpoint, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify(payload)
          });

          if(!res.ok){
            throw new Error('전송 실패');
          }
        }else{
          console.log('예약 데이터', payload);
        }

        alert('예약 신청이 접수되었습니다.');
        clearCart();
        form.reset();
        setCaptchaCode(root);
        location.href = '/';
      }catch(err){
        console.error(err);
        alert('예약 접수 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    });
  };
})();
</script>
