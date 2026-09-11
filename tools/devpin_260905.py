# devpin_260905.py — [260905 운영자] 개발 미리보기(YM_ENV==='dev')에서는 PIN 입력 단계를 건너뛰고 곧장 진입. 발행본(/site/)은 그대로 PIN.
#   goToPinStep 의 마지막 분기 한 곳만 바꾼다. 세션에 넣는 PIN 은 담당자 시트의 저장 PIN(훅 재검증용) 그대로.
import io
P='public/standalone.html'
s=io.open(P,encoding='utf-8').read()
a="  } else {\n    _enterPinInputStep();\n  }\n  }catch(err){ console.error('[goToPin] UNCAUGHT:'"
assert s.count(a)==1, ('anchor', s.count(a))
b="  } else if(window.YM_ENV==='dev'){   // [260905 운영자] 개발 미리보기는 PIN 칸 없이 곧장 진입(발행본은 그대로)\n    _enterAsManager(matched, storedPin, userName);\n  } else {\n    _enterPinInputStep();\n  }\n  }catch(err){ console.error('[goToPin] UNCAUGHT:'"
s=s.replace(a,b)
io.open(P,'w',encoding='utf-8').write(s)
print('OK devpin', len(s), s.count('[260905 운영자] 개발 미리보기는 PIN'))
