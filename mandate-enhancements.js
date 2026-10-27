(() => {
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = 'mandate-enhancements.css?v=20261026-9';
  document.head.append(style);

  const form = document.getElementById('f');
  form.querySelectorAll('input[type="file"]').forEach(input => {
    input.closest('label')?.classList.add('document-upload');
  });
  const originalPageCount = pages.length;
  const oldError = document.getElementById('err');
  const declaration = [...form.querySelectorAll('section')].find(
    section => section.querySelector('h2')?.textContent.trim() === 'Declaration'
  );
  declaration?.querySelector('[name="decl"]')?.closest('label')?.classList.add('declaration-acceptance');
  const submitButton = form.querySelector('button[type="submit"]');
  const resultBox = document.getElementById('res');
  const oldPage = pages[6];
  const declarationHeading = oldPage.querySelector('.wizard-heading');
  const reviewPage = document.createElement('div');
  const reviewHeading = document.createElement('h2');

  pageDefs[6].title = 'Declarations & signing';
  declarationHeading.textContent = pageDefs[6].title;
  stepList.querySelector('#wizard-step-6').textContent = pageDefs[6].title;
  pageDefs.push({ title: 'Review & submit', sections: [] });
  reviewPage.className = 'wizard-page';
  reviewPage.id = `wizard-page-${pages.length}`;
  reviewHeading.className = 'wizard-heading';
  reviewHeading.id = `wizard-heading-${pages.length}`;
  reviewHeading.tabIndex = -1;
  reviewHeading.textContent = 'Review & submit';
  reviewPage.setAttribute('aria-labelledby', reviewHeading.id);
  reviewPage.append(reviewHeading);
  pages.push(reviewPage);
  form.append(reviewPage);

  if (oldError) oldError.remove();

  const alertByPage = new Map();
  pages.forEach((page, index) => {
    const banner = document.createElement('div');
    banner.className = 'page-error';
    banner.setAttribute('role', 'alert');
    banner.tabIndex = -1;
    banner.hidden = true;
    banner.id = `page-error-${index}`;
    page.insertBefore(banner, page.children[1] || null);
    alertByPage.set(index, banner);
  });

  const controls = oldPage.querySelector('.wizard-controls');
  const declarationNext = document.createElement('button');
  declarationNext.type = 'button';
  declarationNext.className = 'wizard-next';
  declarationNext.textContent = 'Continue to review';
  controls.append(declarationNext);

  const reviewControls = document.createElement('div');
  reviewControls.className = 'wizard-controls';
  const reviewBack = document.createElement('button');
  reviewBack.type = 'button';
  reviewBack.className = 's wizard-back';
  reviewBack.textContent = 'Back';
  reviewControls.append(reviewBack);
  reviewPage.append(reviewControls);
  reviewPage.append(submitButton);

  const reviewList = document.createElement('div');
  reviewList.className = 'review-list';
  reviewList.setAttribute('aria-live', 'polite');
  reviewPage.insertBefore(reviewList, reviewControls);

  resultBox.innerHTML = '<p id="mailstatus" role="status" aria-live="polite"></p><button type="button" onclick="print()">Print / save as PDF</button>';
  reviewPage.append(resultBox);

  const stepItem = document.createElement('li');
  stepItem.id = `wizard-step-${pages.length - 1}`;
  stepItem.textContent = pageDefs[pageDefs.length - 1].title;
  stepList.append(stepItem);

  const placeField = document.createElement('label');
  placeField.className = 'full';
  placeField.textContent = 'Place of signing';
  const placeInput = document.createElement('input');
  placeInput.type = 'text';
  placeInput.name = 'signing_place';
  placeInput.autocomplete = 'address-level2';
  placeField.append(placeInput);

  const signatureWrap = document.createElement('div');
  signatureWrap.className = 'full declaration-signature';
  const methodGroup = document.createElement('fieldset');
  methodGroup.dataset.fieldName = 'signature_choice';
  const methodLegend = document.createElement('legend');
  methodLegend.textContent = 'Declaration signature';
  methodGroup.append(methodLegend);
  [
    ['specimen', 'Use specimen signature'],
    ['self', 'Sign yourself']
  ].forEach(([value, labelText]) => {
    const label = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'signature_choice';
    radio.value = value;
    label.append(radio, document.createTextNode(labelText));
    methodGroup.append(label);
  });

  const specimenPanel = document.createElement('div');
  specimenPanel.className = 'full';
  specimenPanel.hidden = true;
  specimenPanel.textContent = 'The specimen signature uploaded with your supporting documents will be used.';

  const selfPanel = document.createElement('div');
  selfPanel.className = 'full';
  selfPanel.hidden = true;
  const typedLabel = document.createElement('label');
  typedLabel.textContent = 'Type your full name as your signature';
  const typedSignature = document.createElement('input');
  typedSignature.type = 'text';
  typedSignature.name = 'typed_signature';
  typedSignature.autocomplete = 'name';
  typedLabel.append(typedSignature);
  const canvasLabel = document.createElement('label');
  canvasLabel.className = 'full';
  canvasLabel.textContent = 'Or draw your signature';
  const signatureCanvas = document.createElement('canvas');
  signatureCanvas.id = 'declaration-signature';
  signatureCanvas.width = 1000;
  signatureCanvas.height = 260;
  canvasLabel.append(signatureCanvas);
  const signatureTools = document.createElement('div');
  signatureTools.className = 'signature-tools';
  const clearSignature = document.createElement('button');
  clearSignature.type = 'button';
  clearSignature.className = 's';
  clearSignature.textContent = 'Clear drawn signature';
  const signatureHint = document.createElement('p');
  signatureHint.className = 'note';
  signatureHint.textContent = 'Provide either a typed or drawn signature.';
  signatureTools.append(clearSignature, signatureHint);
  selfPanel.append(typedLabel, canvasLabel, signatureTools);
  signatureWrap.append(methodGroup, specimenPanel, selfPanel);
  declaration.querySelector('.g').append(placeField, signatureWrap);

  const signatureContext = signatureCanvas.getContext('2d');
  let declarationSignatureDrawn = false;
  let drawing = false;
  signatureContext.lineWidth = 5;
  signatureContext.lineCap = 'round';
  signatureContext.lineJoin = 'round';
  signatureContext.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#1d2433';

  const signaturePoint = event => {
    const rect = signatureCanvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * signatureCanvas.width / rect.width,
      y: (event.clientY - rect.top) * signatureCanvas.height / rect.height
    };
  };
  signatureCanvas.addEventListener('pointerdown', event => {
    drawing = true;
    signatureCanvas.setPointerCapture(event.pointerId);
    const point = signaturePoint(event);
    signatureContext.beginPath();
    signatureContext.moveTo(point.x, point.y);
    signatureContext.lineTo(point.x + 0.1, point.y + 0.1);
    signatureContext.stroke();
    declarationSignatureDrawn = true;
  });
  signatureCanvas.addEventListener('pointermove', event => {
    if (!drawing) return;
    const point = signaturePoint(event);
    signatureContext.lineTo(point.x, point.y);
    signatureContext.stroke();
  });
  const stopDrawing = () => {
    drawing = false;
    if (attempted) refreshErrors();
    queueDraftSave();
  };
  signatureCanvas.addEventListener('pointerup', stopDrawing);
  signatureCanvas.addEventListener('pointercancel', stopDrawing);
  clearSignature.addEventListener('click', () => {
    signatureContext.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
    declarationSignatureDrawn = false;
    if (attempted) refreshErrors();
    queueDraftSave();
  });
  pads.declaration = {
    c: signatureCanvas,
    x: signatureContext,
    get drawn() { return declarationSignatureDrawn; },
    set drawn(value) { declarationSignatureDrawn = value; }
  };

  const savedDraft = () => {
    try {
      return JSON.parse(localStorage.getItem('lp28') || 'null');
    } catch {
      return null;
    }
  };
  const saved = savedDraft();
  if (saved?.fields) {
    if (typeof saved.fields.signing_place === 'string') placeInput.value = saved.fields.signing_place;
    if (typeof saved.fields.signature_choice === 'string') {
      form.querySelectorAll('[name="signature_choice"]').forEach(radio => {
        radio.checked = radio.value === saved.fields.signature_choice;
      });
    }
    if (typeof saved.fields.typed_signature === 'string') typedSignature.value = saved.fields.typed_signature;
    const savedImage = saved.signatures?.declaration;
    if (savedImage) {
      const image = new Image();
      image.onload = () => {
        signatureContext.drawImage(image, 0, 0, signatureCanvas.width, signatureCanvas.height);
        declarationSignatureDrawn = true;
      };
      image.src = savedImage;
    }
  }

  const updateSignatureChoice = () => {
    const chosen = form.querySelector('[name="signature_choice"]:checked')?.value;
    specimenPanel.hidden = chosen !== 'specimen';
    selfPanel.hidden = chosen !== 'self';
    const specimenFile = form.querySelector('[name="spec"]');
    const specimenMark = specimenFile?.closest('label')?.querySelector('em');
    if (specimenFile) specimenFile.required = chosen === 'specimen';
    if (specimenMark) specimenMark.hidden = chosen !== 'specimen';
  };
  form.addEventListener('change', event => {
    if (event.target.name === 'signature_choice') updateSignatureChoice();
  });
  updateSignatureChoice();

  const reviewLabel = control => {
    const conciseLabels = {
      terms: 'Terms accepted',
      decl: 'Declaration confirmed',
      fx_consent: 'Foreign tax information sharing consent'
    };
    if (conciseLabels[control.name]) return conciseLabels[control.name];
    const fieldset = control.closest('fieldset');
    if (fieldset) return fieldset.querySelector('legend')?.textContent.trim() || control.name;
    const label = control.closest('label');
    if (!label) return control.name;
    const clone = label.cloneNode(true);
    clone.querySelectorAll('input, textarea, select, canvas, button, em').forEach(el => el.remove());
    return clone.textContent.trim() || control.name;
  };

  const visibleControl = control => !control.closest('[hidden]:not(.wizard-page)');
  const fieldValue = control => {
    if (control.name === 'signature_choice') {
      return control.value === 'specimen' ? 'Use specimen signature' : 'Sign yourself';
    }
    if (control.name === 'initial' && Number.isFinite(Number(control.value))) {
      return new Intl.NumberFormat('en-GH', { maximumFractionDigits: 2 }).format(Number(control.value));
    }
    if (control.type === 'file') return control.files?.length ? [...control.files].map(file => file.name).join(', ') : '';
    if (control.type === 'checkbox' || control.type === 'radio') return control.checked ? control.value : '';
    return String(control.value || '').trim();
  };

  const renderReview = () => {
    reviewList.replaceChildren();
    pages.slice(0, originalPageCount).forEach((page, pageIndex) => {
      page.querySelectorAll('section').forEach(section => {
        const title = section.querySelector('h2')?.textContent.trim();
        if (!title) return;
        const values = new Map();
        section.querySelectorAll('input[name], textarea[name], select[name]').forEach(control => {
          if (!visibleControl(control)) return;
          const name = control.name;
          const value = fieldValue(control);
          if (!value) return;
          const label = reviewLabel(control);
          if (control.type === 'checkbox' && values.has(name)) {
            const prior = values.get(name);
            values.set(name, { label, value: `${prior.value}, ${value}` });
          } else if (control.type !== 'radio' || control.checked) {
            values.set(name, { label, value });
          }
        });
        section.querySelectorAll('canvas').forEach(canvas => {
          const pad = Object.values(pads).find(item => item.c === canvas);
          if (!visibleControl(canvas) || !pad?.drawn) return;
          values.set(canvas.id, {
            label: canvas.id === 'declaration-signature' ? 'Declaration signature' : ({ s1: 'Signature I', s2: 'Signature II', indem: 'Email / telephone / fax indemnity signature' }[canvas.id] || 'Signature'),
            value: 'Signed'
          });
        });
        if (!values.size) return;

        const card = document.createElement('section');
        card.className = 'review-section';
        const heading = document.createElement('div');
        heading.className = 'review-section-header';
        const sectionTitle = document.createElement('h3');
        sectionTitle.textContent = title;
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 's';
        edit.textContent = 'Edit';
        edit.setAttribute('aria-label', `Edit ${title}`);
        edit.addEventListener('click', () => goToPage(pageIndex));
        heading.append(sectionTitle, edit);
        const fields = document.createElement('dl');
        fields.className = 'review-fields';
        values.forEach(entry => {
          const item = typeof entry === 'string' ? { label: '', value: entry } : entry;
          if (!item?.value) return;
          const term = document.createElement('dt');
          term.textContent = item.label;
          const detail = document.createElement('dd');
          detail.textContent = item.value;
          fields.append(term, detail);
        });
        card.append(heading, fields);
        reviewList.append(card);
      });
    });
  };

  const controlFor = name => form.querySelector(`[name="${name}"]`);
  const errors = [];
  const addError = (name, message, explicitControl) => {
    const control = explicitControl || controlFor(name);
    const page = control?.closest('.wizard-page');
    errors.push({
      name,
      message,
      control: control || submitButton,
      section: control?.closest('section, details'),
      pageIndex: page ? pages.indexOf(page) : 0
    });
  };
  const checked = name => form.querySelector(`[name="${name}"]:checked`);

  function collectErrors() {
    errors.length = 0;
    [
      ['a1_surname', 'Applicant 1 surname is required.'],
      ['a1_first', 'Applicant 1 first name is required.'],
      ['a1_dob', 'Applicant 1 date of birth is required.'],
      ['a1_email', 'Applicant 1 email is required.'],
      ['a1_phone', 'Applicant 1 mobile is required.']
    ].forEach(([name, message]) => {
      if (!String(val(name) || '').trim()) addError(name, message);
    });
    const email = controlFor('a1_email');
    if (email?.value && !email.checkValidity()) addError('a1_email', 'Enter a valid email address.');

    if (!checked('mtype')) addError('mtype', 'Choose a mandate type.');

    const initial = controlFor('initial');
    if (!String(initial?.value || '').trim()) {
      addError('initial', 'Initial participation is required.');
    } else if (!Number.isFinite(Number(initial.value)) || Number(initial.value) < 50000) {
      addError('initial', 'Initial participation cannot be less than 50,000.');
    }

    const shares = ['bA_', 'bB_', 'bC_'].map(prefix => Number(val(`${prefix}share`) || 0));
    const totalShare = shares.reduce((sum, share) => sum + share, 0);
    if (totalShare && totalShare !== 100) {
      const field = controlFor('bA_share') || controlFor('bB_share') || controlFor('bC_share');
      addError(field?.name || 'bA_share', `Beneficiary shares add up to ${totalShare}%, not 100%.`, field);
    }

    [['terms', 'terms acceptance'], ['decl', 'declaration']].forEach(([name, label]) => {
      if (!checked(name)) addError(name, `Please confirm the ${label}.`);
    });
    if (!pads.s1.drawn) addError('s1name', 'Signature I is required.', pads.s1.c);
    if (checked('mtype')?.value === 'Joint Mandate' && !pads.s2.drawn) {
      addError('s2name', 'Signature II is required for joint mandates.', pads.s2.c);
    }
    if (!pads.indem.drawn) {
      addError('indem', 'Email / telephone / fax indemnity signature is required.', pads.indem.c);
    }

    const docs = [
      ['pod', 'Proof of Deposit'],
      ['photo', 'Passport size photo'],
      ['ghfront', 'Ghana Card Front'],
      ['ghback', 'Ghana Card Back'],
      ['bghfront', '(Beneficiary) Ghana Card Front'],
      ['bghback', '(Beneficiary) Ghana Card Back'],
      ['poa', 'Proof of Address']
    ];
    docs.forEach(([name, label]) => {
      const fileInput = controlFor(name);
      if (!fileInput?.files?.length) addError(name, `Please upload: ${label}.`);
      else if (fileInput.files[0].size > 5 * 1024 * 1024) addError(name, `${label} exceeds 5 MB.`);
    });

    const place = controlFor('signing_place');
    if (!place.value.trim()) addError('signing_place', 'Place of signing is required.');
    const choice = checked('signature_choice')?.value;
    if (!choice) addError('signature_choice', 'Choose how you want to sign the declaration.');
    if (choice === 'specimen') {
      const specimen = controlFor('spec');
      if (!specimen?.files?.length) addError('spec', 'Upload a specimen signature or choose to sign yourself.');
      else if (specimen.files[0].size > 5 * 1024 * 1024) addError('spec', 'Specimen Signature exceeds 5 MB.');
    } else if (choice === 'self' && !typedSignature.value.trim() && !declarationSignatureDrawn) {
      addError('typed_signature', 'Type or draw your signature before continuing.');
    }
  }

  function refreshErrors() {
    collectErrors();
    form.querySelectorAll('.section-error').forEach(banner => banner.remove());
    pages.forEach((page, index) => {
      const banner = alertByPage.get(index);
      const pageErrors = errors.filter(error => error.pageIndex === index);
      banner.replaceChildren();
      if (!pageErrors.length) {
        banner.hidden = true;
        return;
      }
      banner.hidden = false;
      const message = document.createElement('strong');
      message.textContent = `Please correct ${pageErrors.length} ${pageErrors.length === 1 ? 'issue' : 'issues'} on this page:`;
      const list = document.createElement('ul');
      pageErrors.forEach(error => {
        const item = document.createElement('li');
        item.textContent = error.message;
        list.append(item);
      });
      banner.append(message, list);
    });

    const errorsBySection = new Map();
    errors.forEach(error => {
      if (!error.section) return;
      const sectionErrors = errorsBySection.get(error.section) || [];
      sectionErrors.push(error);
      errorsBySection.set(error.section, sectionErrors);
    });
    errorsBySection.forEach((sectionErrors, section) => {
      const banner = document.createElement('div');
      banner.className = 'section-error';
      banner.setAttribute('role', 'alert');
      const heading = section.querySelector(':scope > h2, :scope > summary');
      const title = heading?.textContent.trim() || 'this section';
      const message = document.createElement('strong');
      message.textContent = `Please correct ${sectionErrors.length} ${sectionErrors.length === 1 ? 'issue' : 'issues'} in ${title}:`;
      const list = document.createElement('ul');
      sectionErrors.forEach(error => {
        const item = document.createElement('li');
        item.textContent = error.message;
        list.append(item);
      });
      banner.append(message, list);
      if (heading) heading.insertAdjacentElement('afterend', banner);
      else section.prepend(banner);
    });

    form.querySelectorAll('.field-error').forEach(control => control.classList.remove('field-error'));
    form.querySelectorAll('[aria-invalid="true"]').forEach(control => control.removeAttribute('aria-invalid'));
    errors.forEach(error => {
      const control = error.control;
      control.setAttribute('aria-invalid', 'true');
      const group = control.closest('fieldset') || control.closest('label') || control;
      group.classList.add('field-error');
    });
  }

  function goToPage(index, focus = true) {
    currentStep = index;
    updateWizard();
    saveDraft();
    if (focus) {
      const heading = document.getElementById(`wizard-heading-${index}`);
      heading?.focus();
      heading?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }
  }
  setStep = goToPage;

  form.addEventListener('click', event => {
    const button = event.target.closest('.wizard-back, .wizard-next');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const steps = visibleSteps();
    const position = steps.indexOf(currentStep);
    if (button.classList.contains('wizard-back')) {
      if (position > 0) goToPage(steps[position - 1]);
    } else if (position >= 0 && position < steps.length - 1) {
      goToPage(steps[position + 1]);
      if (steps[position + 1] === pages.length - 1) renderReview();
    }
  }, true);

  let attempted = false;
  form.addEventListener('input', () => {
    if (!attempted) return;
    refreshErrors();
    renderReview();
  });
  form.addEventListener('change', () => {
    if (!attempted) return;
    refreshErrors();
    renderReview();
  });

  const initialInput = controlFor('initial');
  initialInput.min = '50000';
  initialInput.step = '1';
  initialInput.required = true;

  const signatureReuse = ['s2'].map(id => {
    const pad = pads[id];
    const signatureField = pad.c.closest('.full');
    const option = document.createElement('label');
    const checkbox = document.createElement('input');
    const clearButton = signatureField.querySelector('button');
    option.className = 'signature-reuse-option';
    option.hidden = true;
    checkbox.type = 'checkbox';
    checkbox.name = `reuse_signature_${id}`;
    checkbox.value = 'signature-I';
    option.append(checkbox, document.createTextNode(`Use Signature I for ${id === 's2' ? 'Signature II' : 'Email / telephone / fax indemnity'}`));
    signatureField.after(option);
    return { id, pad, checkbox, option, clearButton, scale: 2, copied: false };
  });

  const declarationReuseOption = document.createElement('label');
  const declarationReuseCheckbox = document.createElement('input');
  declarationReuseOption.className = 'signature-reuse-option';
  declarationReuseOption.hidden = true;
  declarationReuseCheckbox.type = 'checkbox';
  declarationReuseCheckbox.name = 'reuse_signature_declaration';
  declarationReuseCheckbox.value = 'signature-I';
  declarationReuseOption.append(
    declarationReuseCheckbox,
    document.createTextNode('Use Signature I for the declaration signature')
  );
  signatureTools.append(declarationReuseOption);
  signatureReuse.push({
    id: 'declaration',
    pad: pads.declaration,
    checkbox: declarationReuseCheckbox,
    option: declarationReuseOption,
    clearButton: clearSignature,
    scale: 1,
    copied: false
  });

  const ensurePadDimensions = pad => {
    if (pad.c === signatureCanvas) return true;
    if (pad.c.width > 0 && pad.c.height > 0) return true;
    const rect = pad.c.getBoundingClientRect();
    const width = pads.s1.c.width || Math.round(rect.width * 2);
    const height = pads.s1.c.height || Math.round(rect.height * 2);
    if (!width || !height) return false;
    pad.c.width = width;
    pad.c.height = height;
    pad.x.scale(2, 2);
    pad.x.lineWidth = 2;
    pad.x.lineCap = 'round';
    pad.x.strokeStyle = getComputedStyle(document.body).color;
    return true;
  };

  const updateSignatureReuse = () => {
    signatureReuse.forEach(({ pad, checkbox, option, clearButton, scale }, index) => {
      const sourceAvailable = pads.s1.drawn;
      option.hidden = !sourceAvailable;
      if (!sourceAvailable && checkbox.checked) checkbox.checked = false;
      if (checkbox.checked) {
        if (!ensurePadDimensions(pad)) return;
        pad.x.setTransform(1, 0, 0, 1, 0, 0);
        pad.x.clearRect(0, 0, pad.c.width, pad.c.height);
        pad.x.drawImage(pads.s1.c, 0, 0, pad.c.width, pad.c.height);
        if (scale !== 1) pad.x.setTransform(scale, 0, 0, scale, 0, 0);
        pad.drawn = true;
        pad.c.style.pointerEvents = 'none';
        pad.c.setAttribute('aria-disabled', 'true');
        clearButton.disabled = true;
        signatureReuse[index].copied = true;
      } else {
        if (signatureReuse[index].copied) {
          pad.x.setTransform(1, 0, 0, 1, 0, 0);
          pad.x.clearRect(0, 0, pad.c.width, pad.c.height);
          if (scale !== 1) pad.x.setTransform(scale, 0, 0, scale, 0, 0);
          pad.drawn = false;
          signatureReuse[index].copied = false;
        }
        pad.c.style.pointerEvents = '';
        pad.c.removeAttribute('aria-disabled');
        clearButton.disabled = false;
      }
    });
  };

  signatureReuse.forEach(({ checkbox }) => {
    checkbox.addEventListener('change', () => {
      updateSignatureReuse();
      if (attempted) {
        refreshErrors();
        renderReview();
      }
      queueDraftSave();
    });
    try {
      const saved = JSON.parse(localStorage.getItem('lp28') || 'null');
      const savedValues = saved?.fields?.[checkbox.name];
      checkbox.checked = Array.isArray(savedValues) && savedValues.includes(checkbox.value);
    } catch (error) {
      console.warn('Saved signature reuse preferences could not be restored.', error);
    }
  });
  const refreshSignatureReuse = () => {
    updateSignatureReuse();
    queueDraftSave();
  };
  pads.s1.c.addEventListener('pointerup', refreshSignatureReuse);
  pads.s1.c.addEventListener('pointercancel', refreshSignatureReuse);
  pads.s1.c.closest('.full').querySelector('button').addEventListener('click', refreshSignatureReuse);
  form.addEventListener('change', () => {
    signatureReuse.forEach(({ pad }) => ensurePadDimensions(pad));
    updateSignatureReuse();
  });
  const savedSignature = (() => {
    try {
      return JSON.parse(localStorage.getItem('lp28') || 'null')?.signatures?.s1;
    } catch (error) {
      console.warn('The saved primary signature could not be restored for reuse.', error);
      return null;
    }
  })();
  if (savedSignature) {
    const image = new Image();
    image.onload = () => {
      if (!pads.s1.drawn) {
        pads.s1.x.drawImage(image, 0, 0, pads.s1.c.width / 2, pads.s1.c.height / 2);
        pads.s1.drawn = true;
      }
      updateSignatureReuse();
    };
    image.onerror = () => console.warn('The saved primary signature image could not be loaded for reuse.');
    image.src = savedSignature;
  } else {
    updateSignatureReuse();
  }

  const oldBuildPrint = buildPrint;
  buildPrint = data => {
    oldBuildPrint(data);
    const printDoc = document.getElementById('printdoc');
    const addPrintRow = (label, value) => {
      const row = document.createElement('div');
      row.className = 'pd-row';
      const key = document.createElement('span');
      key.className = 'pd-l';
      key.textContent = label;
      const detail = document.createElement('span');
      detail.textContent = value;
      row.append(key, detail);
      printDoc.append(row);
    };
    addPrintRow('Place of signing', data.signing_place || '');
    addPrintRow('Declaration signature option', data.signature_choice === 'specimen' ? 'Use specimen signature' : 'Sign yourself');
    if (data.signature_choice === 'self' && data.typed_signature) addPrintRow('Typed declaration signature', data.typed_signature);
    if (data.signature_choice === 'self' && declarationSignatureDrawn) {
      const row = document.createElement('div');
      row.className = 'pd-row';
      const key = document.createElement('span');
      key.className = 'pd-l';
      key.textContent = 'Drawn declaration signature';
      const image = document.createElement('img');
      image.className = 'pd-sig';
      image.alt = 'Drawn declaration signature';
      image.src = signatureCanvas.toDataURL('image/png');
      row.append(key, image);
      printDoc.append(row);
    }
  };

  form.onsubmit = async event => {
    event.preventDefault();
    attempted = true;
    refreshErrors();
    renderReview();
    if (errors.length) {
      const first = errors[0];
      goToPage(first.pageIndex, false);
      requestAnimationFrame(() => {
        const banner = alertByPage.get(first.pageIndex);
        banner.focus();
        first.control.focus?.({ preventScroll: true });
        (first.control.closest('label, fieldset') || first.control).scrollIntoView({
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'center'
        });
      });
      return;
    }

    const data = Object.fromEntries(new FormData(form));
    data.ref = '28JFM26';
    data.signedAt = new Date().toISOString();
    data.sig1 = pads.s1.c.toDataURL('image/png').slice(0, 60);
    buildPrint(data);
    resultBox.hidden = false;
    goToPage(pages.length - 1, false);
    await sendPdf(data);
  };

  async function sendPdf(data) {
    const status = document.getElementById('mailstatus');
    const submit = form.querySelector('button[type="submit"]');
    const printButton = resultBox.querySelector('button');
    submit.disabled = true;
    status.setAttribute('role', 'status');
    status.textContent = 'Preparing the PDF and securely sending your application…';

    try {
      if (!window.html2pdf) {
        throw new Error('The PDF generator could not be loaded. Check your connection and try again.');
      }
      const fileName = `Mandate-${data.ref}-${String(data.a1_surname || 'Applicant').replace(/\s+/g, '_')}.pdf`;
      const printDocument = document.getElementById('printdoc');
      if (!printDocument.textContent.trim()) {
        throw new Error('The application details could not be prepared for the PDF. Please try again.');
      }
      // Capture the live print document with the dedicated export stylesheet
      // so the emailed PDF matches the Print / Save-as-PDF output: full width,
      // no transforms, and no sticky or fixed positioning.
      const exportDocumentElement = document.documentElement;
      exportDocumentElement.classList.add('pdf-export');
      let hasVisibleCapture = false;
      let pdf;
      try {
        if (document.fonts?.ready) await document.fonts.ready;
        await Promise.all([...printDocument.querySelectorAll('img')].map(image => image.decode()));
        const pdfWorker = html2pdf()
          .set({
            margin: [10, 10, 10, 10],
            filename: fileName,
            image: { type: 'jpeg', quality: 0.8 },
            html2canvas: {
              scale: 1,
              useCORS: true,
              backgroundColor: '#fff',
              windowWidth: Math.max(printDocument.scrollWidth, 800),
              windowHeight: Math.max(window.innerHeight, printDocument.scrollHeight),
              scrollX: 0,
              scrollY: 0,
              onclone: clonedDocument => {
                const clonedPrintDoc = clonedDocument.getElementById('printdoc');
                if (!clonedPrintDoc || !clonedPrintDoc.textContent.trim()) {
                  throw new Error('The application details could not be prepared for the PDF. Please try again.');
                }
                // Keep the capture identical to print output: full width with
                // no transforms and no sticky or fixed positioning.
                clonedPrintDoc.querySelectorAll('*').forEach(element => {
                  element.style.transform = 'none';
                  element.style.position = 'static';
                });
                // Reserve the logo box in the cloned render document so the
                // heading cannot overlap it before the SVG finishes loading.
                clonedPrintDoc.querySelectorAll('.pd-head .logo').forEach(logo => {
                  logo.style.display = 'block';
                  logo.style.width = '140px';
                  logo.style.maxWidth = '140px';
                  logo.style.height = '25px';
                  logo.style.margin = '0 0 10px';
                });
              }
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
          })
          .from(printDocument);
        await pdfWorker.toContainer();

        await pdfWorker.toCanvas();
        const canvas = await pdfWorker.get('canvas');
        if (!canvas || canvas.width < 1 || canvas.height < 1) {
          throw new Error('The application page could not be rendered. Please try again or use Print / Save PDF.');
        }
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('The application page could not be checked. Please try again.');
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        for (let index = 0; index < pixels.length; index += 4) {
          if (pixels[index + 3] > 0 && (pixels[index] < 245 || pixels[index + 1] < 245 || pixels[index + 2] < 245)) {
            hasVisibleCapture = true;
            break;
          }
        }
        if (!hasVisibleCapture) {
          throw new Error('The application page rendered blank, so it was not sent. Please try again or use Print / Save PDF.');
        }
        await pdfWorker.toPdf();
        pdf = await pdfWorker.get('pdf');
      } finally {
        exportDocumentElement.classList.remove('pdf-export');
      }
      if (!pdf) throw new Error('The PDF could not be prepared. Please try again.');

      for (let page = 1; page <= pdf.internal.getNumberOfPages(); page++) {
        pdf.setPage(page);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(100);
        pdf.text(`Mandate ${data.ref} - ${data.a1_first || ''} ${data.a1_surname || ''}`.trim(), 12, pdf.internal.pageSize.getHeight() - 5);
      }

      const pdfBlob = await pdf.output('blob');
      if (pdfBlob.size > 5 * 1024 * 1024) {
        throw new Error('The generated PDF exceeds the 5 MB upload limit. Reduce the number of optional details and try again.');
      }

      const pdfContent = new TextDecoder('latin1').decode(await pdfBlob.arrayBuffer());
      if (!/\bBT\b/.test(pdfContent) || !/\bTj\b|\bTJ\b/.test(pdfContent)) {
        throw new Error('The PDF was generated without visible application content. Please try again.');
      }

      const submission = new FormData();
      submission.append('ref', data.ref);
      submission.append('applicant', [data.a1_first, data.a1_surname].filter(Boolean).join(' '));
      submission.append('email', data.a1_email || '');
      submission.append('mandate_pdf', pdfBlob, fileName);
      [
        ['pod', 'pod'],
        ['photo', 'photo'],
        ['ghfront', 'ghfront'],
        ['ghback', 'ghback'],
        ['bghfront', 'bghfront'],
        ['bghback', 'bghback'],
        ['poa', 'poa'],
        ['spec', 'spec']
      ].forEach(([fieldName, inputName]) => {
        const selected = form.querySelector(`[name="${inputName}"]`)?.files?.[0];
        if (selected) submission.append(fieldName, selected, selected.name);
      });

      const response = await fetch('/api/submit', { method: 'POST', body: submission });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Submission failed with status ${response.status}.`);
      clearTimeout(saveTimer);
      try {
        localStorage.removeItem('lp28');
      } catch (error) {
        console.warn('The submitted draft could not be removed from local storage.', error);
      }
      status.textContent = result.message || 'Your application was submitted successfully.';
      status.setAttribute('role', 'status');
      if (printButton) printButton.disabled = false;
    } catch (error) {
      console.error('Mandate submission email failed.', error);
      status.textContent = `Submission was not sent. ${error?.message || 'Check your connection and try again.'}`;
      status.setAttribute('role', 'alert');
      if (printButton) printButton.disabled = false;
    } finally {
      submit.disabled = false;
    }
  }

  updateWizard();
})();
