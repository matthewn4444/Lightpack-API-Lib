rem Compiles and places the nw file into the release and debug folders
del ..\..\Release\app.nw
copy ..\..\Release\lightpack.node lightpack.node
zip ..\..\Release\app.nw index.html package.json *.js lightpack.node
copy "..\..\Release\app.nw" "..\..\Debug\app.nw"
