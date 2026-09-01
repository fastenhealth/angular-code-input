import { SimpleChange } from '@angular/core';
import { ComponentFixture, fakeAsync, flushMicrotasks, TestBed, tick, waitForAsync } from '@angular/core/testing';

import { CodeInputComponent } from './code-input.component';

describe('CodeInputComponent', () => {
  let component: CodeInputComponent;
  let fixture: ComponentFixture<CodeInputComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ CodeInputComponent ]
    }).compileComponents();

    fixture = TestBed.createComponent(CodeInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  function getInputs(): HTMLInputElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('input'));
  }

  function createInputEvent(target: HTMLInputElement, data: string): {
    target: HTMLInputElement;
    data: string;
    preventDefault: jasmine.Spy;
    stopPropagation: jasmine.Spy;
  } {
    return {
      target,
      data,
      preventDefault: jasmine.createSpy('preventDefault'),
      stopPropagation: jasmine.createSpy('stopPropagation')
    };
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render four numeric telephone inputs by default', () => {
    const inputs = getInputs();

    expect(inputs.length).toBe(4);
    inputs.forEach(input => {
      expect(input.type).toBe('tel');
      expect(input.inputMode).toBe('numeric');
      expect(input.disabled).toBeFalse();
      expect(input.autocomplete).toBe('one-time-code');
    });
  });

  it('should apply valid application-level configuration', () => {
    const configured = new CodeInputComponent({
      codeLength: 6,
      inputType: 'password',
      isCharsCode: true,
      disabled: true
    });

    expect(configured.codeLength).toBe(6);
    expect(configured.inputType).toBe('password');
    expect(configured.isCharsCode).toBeTrue();
    expect(configured.disabled).toBeTrue();
  });

  it('should grow and shrink the rendered inputs when codeLength changes', () => {
    component.codeLength = 6;
    component.ngOnChanges({codeLength: new SimpleChange(4, 6, false)});
    fixture.detectChanges();
    expect(getInputs().length).toBe(6);

    component.codeLength = 2;
    component.ngOnChanges({codeLength: new SimpleChange(6, 2, false)});
    fixture.detectChanges();
    expect(getInputs().length).toBe(2);
  });

  it('should fill multiple inputs, advance focus, and emit partial and completed codes', fakeAsync(() => {
    const inputs = getInputs();
    const changedSpy = spyOn(component.codeChanged, 'emit');
    const completedSpy = spyOn(component.codeCompleted, 'emit');
    const focusSpy = spyOn(inputs[2], 'focus').and.callThrough();

    component.onInput(createInputEvent(inputs[0], '12'), 0);
    tick(50);

    expect(inputs.map(input => input.value)).toEqual(['1', '2', '', '']);
    expect(focusSpy).toHaveBeenCalledWith({preventScroll: true});
    expect(changedSpy).toHaveBeenCalledWith('12');
    expect(completedSpy).not.toHaveBeenCalled();

    component.onInput(createInputEvent(inputs[2], '34'), 2);
    tick(50);

    expect(inputs.map(input => input.value)).toEqual(['1', '2', '3', '4']);
    expect(changedSpy).toHaveBeenCalledWith('1234');
    expect(completedSpy).toHaveBeenCalledWith('1234');
  }));

  it('should reject non-digit input unless character input is enabled', fakeAsync(() => {
    const input = getInputs()[0];
    const invalidEvent = createInputEvent(input, 'a');

    component.onInput(invalidEvent, 0);

    expect(invalidEvent.preventDefault).toHaveBeenCalled();
    expect(invalidEvent.stopPropagation).toHaveBeenCalled();
    expect(input.value).toBe('');

    component.isCharsCode = true;
    component.onInput(createInputEvent(input, 'a'), 0);
    tick(50);

    expect(input.value).toBe('a');
  }));

  it('should paste a complete code and emit completion', fakeAsync(() => {
    const inputs = getInputs();
    const changedSpy = spyOn(component.codeChanged, 'emit');
    const completedSpy = spyOn(component.codeCompleted, 'emit');
    const pasteEvent = {
      clipboardData: {
        getData: () => ' 9876 '
      },
      preventDefault: jasmine.createSpy('preventDefault'),
      stopPropagation: jasmine.createSpy('stopPropagation')
    } as unknown as ClipboardEvent;

    component.onPaste(pasteEvent, 0);
    tick(50);

    expect(pasteEvent.preventDefault).toHaveBeenCalled();
    expect(pasteEvent.stopPropagation).toHaveBeenCalled();
    expect(inputs.map(input => input.value)).toEqual(['9', '8', '7', '6']);
    expect(changedSpy).toHaveBeenCalledWith('9876');
    expect(completedSpy).toHaveBeenCalledWith('9876');
  }));

  it('should restore the configured code or clear it during reset', fakeAsync(() => {
    const inputs = getInputs();
    const changedSpy = spyOn(component.codeChanged, 'emit');

    component.code = '2468';
    component.reset();
    expect(inputs.map(input => input.value)).toEqual(['2', '4', '6', '8']);

    component.code = undefined;
    component.reset(true);
    tick(50);

    expect(inputs.map(input => input.value)).toEqual(['', '', '', '']);
    expect(changedSpy).toHaveBeenCalledWith('');
  }));

  it('should focus a valid field and reject an out-of-range field', () => {
    const inputs = getInputs();
    const focusSpy = spyOn(inputs[2], 'focus');

    component.focusOnField(2);

    expect(focusSpy).toHaveBeenCalledWith({preventScroll: true});
    expect(() => component.focusOnField(4)).toThrowError(
      'The index of the focusing input box should be less than the codeLength.'
    );
  });

  it('should clear on backspace and focus the previous input', fakeAsync(() => {
    const inputs = getInputs();
    inputs[0].value = '1';
    inputs[1].value = '2';
    const previousFocusSpy = spyOn(inputs[0], 'focus');
    const changedSpy = spyOn(component.codeChanged, 'emit');
    const event = {
      target: inputs[1],
      key: 'Backspace',
      keyCode: 8,
      preventDefault: jasmine.createSpy('preventDefault')
    };

    component.onKeydown(event, 1);
    flushMicrotasks();
    tick(50);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(inputs[1].value).toBe('');
    expect(previousFocusSpy).toHaveBeenCalledWith({preventScroll: true});
    expect(changedSpy).toHaveBeenCalledWith('1');
  }));

  it('should clear on delete without moving focus to the previous input', fakeAsync(() => {
    const inputs = getInputs();
    inputs[1].value = '2';
    const previousFocusSpy = spyOn(inputs[0], 'focus');
    const event = {
      target: inputs[1],
      key: 'Delete',
      keyCode: 46,
      preventDefault: jasmine.createSpy('preventDefault')
    };

    component.onKeydown(event, 1);
    flushMicrotasks();
    tick(50);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(inputs[1].value).toBe('');
    expect(previousFocusSpy).not.toHaveBeenCalled();
  }));

  it('should reflect disabled, hidden, and text input options in the template', () => {
    component.disabled = true;
    component.isCodeHidden = true;
    component.inputType = 'password';
    component.inputMode = 'text';
    component.autocapitalize = 'characters';
    fixture.detectChanges();

    const inputs = getInputs();
    const wrappers = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('span'));

    inputs.forEach(input => {
      expect(input.disabled).toBeTrue();
      expect(input.type).toBe('password');
      expect(input.inputMode).toBe('text');
      expect(input.autocapitalize).toBe('characters');
    });
    wrappers.forEach(wrapper => expect(wrapper.classList.contains('code-hidden')).toBeTrue());
  });

  it('should focus the final input when a filled code is clicked', fakeAsync(() => {
    const inputs = getInputs();
    inputs.forEach((input, index) => input.value = String(index + 1));
    component.isFocusingOnLastByClickIfFilled = true;
    const lastFocusSpy = spyOn(inputs[3], 'focus');

    component.onClick({target: inputs[0]});
    tick();

    expect(lastFocusSpy).toHaveBeenCalledWith({preventScroll: true});
  }));
});
