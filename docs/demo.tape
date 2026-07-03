# ctxbudget demo — render with:  vhs docs/demo.tape   (https://github.com/charmbracelet/vhs)
# First build the sample project:  bash docs/build-demo-fixture.sh   (creates ~/acme-dashboard)
# Runs against that synthetic project (intentional bloat + duplication).
# Produces docs/demo.gif, embedded in the README.
Output docs/demo.gif

Set FontSize 15
Set Width 1180
Set Height 560
Set Padding 24
Set Theme "Dracula"
Set TypingSpeed 45ms

Type "ctxbudget ~/acme-dashboard"
Sleep 500ms
Enter
Sleep 4.5s
